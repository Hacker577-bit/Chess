import { Chess } from 'chess.js';
import type { Move, Square, PieceSymbol } from 'chess.js';
import { pieceAttacksSquare, countAttackers, isSquareAttacked } from './attacks';

const FILES = 'abcdefgh';
const idx = (s: Square) => ({ r: 8 - parseInt(s[1], 10), c: FILES.indexOf(s[0]) });

const VAL: Record<PieceSymbol, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20_000 };

// Positional bonuses for strategic evaluation (grandmaster+).
// Computes king safety, bishop pair, rook on open files, and pawn structure.
export function positionalBonus(chess: Chess): number {
  let score = 0;
  const b = chess.board();

  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = b[r][c]; if (!p) continue;
    const sign = p.color === 'w' ? 1 : -1;
    const fi = p.square[0].charCodeAt(0) - 97;
    const ri = 8 - parseInt(p.square[1], 10);

    // King safety: bonus for own pawns within a knight's move of the king
    if (p.type === 'k') {
      for (const [df, dr] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1],[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        const nr = ri + df, nc = fi + dr;
        if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
        const ns = b[nr][nc];
        if (ns && ns.type === 'p' && ns.color === p.color) score += sign * 10;
      }
      // Penalty for exposed king (no pawns nearby)
      let pawnShield = 0;
      for (const [df, dr] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1],[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        const nr = ri + df, nc = fi + dr;
        if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
        const ns = b[nr][nc];
        if (ns && ns.type === 'p' && ns.color === p.color) pawnShield++;
      }
      if (pawnShield < 2) score += sign * -30;
    }

    // Bishop pair bonus
    if (p.type === 'b') {
      let same = 0;
      for (let r2 = 0; r2 < 8; r2++) for (let c2 = 0; c2 < 8; c2++) {
        const p2 = b[r2][c2];
        if (p2 && p2.color === p.color && p2.type === 'b') same++;
      }
      if (same >= 2) score += sign * 15;
    }

    // Rook on open file (no friendly pawns on that file)
    if (p.type === 'r') {
      let friendPawn = false;
      for (let r2 = 0; r2 < 8; r2++) {
        const p2 = b[r2][fi];
        if (p2 && p2.type === 'p' && p2.color === p.color) { friendPawn = true; break; }
      }
      if (!friendPawn) score += sign * 12;
    }
  }

  // Pawn structure: penalty for doubled pawns
  for (const color of ['w', 'b'] as const) {
    for (let fi = 0; fi < 8; fi++) {
      let count = 0;
      for (let ri = 0; ri < 8; ri++) {
        const p = b[ri][fi];
        if (p && p.type === 'p' && p.color === color) count++;
      }
      if (count > 1) {
        const s = color === 'w' ? -1 : 1;
        score += s * (count - 1) * -15;
      }
    }
  }

  return score;
}

/**
 * Piece safety evaluation - penalizes hanging pieces and rewards defended pieces.
 * Used by intermediate and grandmaster levels to avoid blunders.
 * 
 * A piece is "hanging" if:
 * - It is attacked by enemy pieces
 * - It is defended by fewer friendly pieces than attackers
 * - The attackers are of lower value than the piece (profitable capture)
 */
export function pieceSafetyBonus(chess: Chess): number {
  let score = 0;
  const b = chess.board();
  const turn = chess.turn();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (!p || p.color !== turn) continue;

      const sq = p.square as Square;
      const pieceValue = VALUE[p.type];

      // Count attackers and defenders
      const attackers = countAttackers(chess, sq, turn === 'w' ? 'b' : 'w');
      const defenders = countAttackers(chess, sq, turn);

      // Hanging piece: attacked and not defended (or under-defended)
      if (attackers > 0) {
        if (defenders === 0) {
          // Completely undefended piece under attack - severe penalty
          score -= pieceValue * 2;
        } else if (defenders < attackers) {
          // Outnumbered - will likely lose the piece
          score -= pieceValue;
        }
      }

      // Bonus for well-defended pieces
      if (defenders > 0 && attackers === 0) {
        score += pieceValue * 0.3;
      }

      // King safety: heavily penalize exposed king
      if (p.type === 'k') {
        const kingSq = sq;
        if (isSquareAttacked(chess, kingSq, turn === 'w' ? 'b' : 'w')) {
          score -= 500; // Major penalty for king in check
        }
        
        // Penalty for weak king pawn cover
        let pawnShield = 0;
        const fi = kingSq[0].charCodeAt(0) - 97;
        const ri = 8 - parseInt(kingSq[1], 10);
        for (const [df, dr] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
          const nr = ri + df, nc = fi + dr;
          if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
            const ns = b[nr][nc];
            if (ns && ns.type === 'p' && ns.color === p.color) pawnShield++;
          }
        }
        if (pawnShield < 2) score -= 100;
      }
    }
  }

  return score;
}

/**
 * Tactical pattern recognition for intermediate+ levels.
 * Detects and evaluates: casts, pins, forks, discovered attacks, skewers.
 */
export function tacticalBonus(chess: Chess): number {
  let score = 0;
  const b = chess.board();
  const turn = chess.turn();
  const enemy = turn === 'w' ? 'b' : 'w';

  // 1. Castling bonus - encourages king safety
  const availMoves = chess.moves({ verbose: true });
  if (availMoves.some(m => m.flags.includes('k') || m.flags.includes('q'))) {
    const kingCol = turn === 'w' ? 4 : 4;
    const kingRow = turn === 'w' ? 7 : 0;
    const king = b[kingRow][kingCol];
    
    // Check if king is currently exposed (attacked or weak pawn shield)
    let kingExposed = false;
    const kingSq = king?.square as Square;
    
    // Is king in check or can be castled to safety?
    if (chess.inCheck()) {
      score += turn === 'w' ? 80 : -80; // Bonus for castling out of check
    }
    
    // Count pawns in front of king
    const pawnShield = countKingPawnShield(b, kingSq, turn);
    if (pawnShield < 2) {
      // King needs to castle for safety
      score += turn === 'w' ? 60 : -60;
    }
  }

  // 2. Knight fork detection - creating and avoiding forks
  const forkScore = knightForkBonus(chess);
  score += forkScore;

  // 3. Pin detection - avoid moving pieces that are pinned
  const pinScore = detectPins(chess, turn);
  score += pinScore;

  // 4. Discovered attack potential
  const discoveredScore = detectDiscoveredAttacks(chess, turn);
  score += discoveredScore;

  // 5. Skewer detection (royal pieces - king and queen aligned)
  const skewerScore = detectSkewers(chess, turn);
  score += skewerScore;

  return score;
}

function countKingPawnShield(board: any[], kingSq: Square, kingColor: 'w' | 'b'): number {
  if (!kingSq) return 0;
  const fi = kingSq[0].charCodeAt(0) - 97;
  const ri = 8 - parseInt(kingSq[1], 10);
  let shield = 0;
  
  // Check pawns in front of king (direction depends on color)
  const dir = kingColor === 'w' ? -1 : 1;
  for (const [df, dr] of [[-1, dir], [0, dir], [1, dir]]) {
    const nr = ri + dr, nc = fi + df;
    if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
      const p = board[nr][nc];
      if (p && p.type === 'p' && p.color === kingColor) shield++;
    }
  }
  return shield;
}

/**
 * Threat detection - identifies and responds to tactical threats.
 */
export function threatBonus(chess: Chess): number {
  let score = 0;
  const turn = chess.turn();

  // Check if current side has any pieces en prise (can be captured for free)
  const moves = chess.moves({ verbose: true });
  for (const m of moves) {
    if (m.captured) {
      const capturedValue = VALUE[m.captured];
      const sign = turn === 'w' ? 1 : -1;
      score += sign * capturedValue;
    }
  }

  return score;
}

/**
 * Fork detection for knights - both creating forks and avoiding them
 * This is separate from tacticalBonus to allow finer control
 */
export function knightForkBonus(chess: Chess): number {
  let score = 0;
  const board = chess.board();
  const turn = chess.turn();
  const enemy = turn === 'w' ? 'b' : 'w';
  
  // Check each of our knights for fork opportunities
  for (const row of board) {
    for (const p of row) {
      if (!p || p.type !== 'n' || p.color !== turn) continue;
      
      const knightSq = p.square as Square;
      const { r, c } = idx(knightSq);
      const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      
      // Check where knight could move to fork enemy pieces
      for (const [dr, dc] of knightMoves) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
        if (board[nr][nc]) continue; // Must be empty square
        
        // Count valuable enemy pieces a knight on this square would attack
        const forked: { type: PieceSymbol; value: number }[] = [];
        for (const [dr2, dc2] of knightMoves) {
          const nr2 = nr + dr2, nc2 = nc + dc2;
          if (nr2 < 0 || nr2 > 7 || nc2 < 0 || nc2 > 7) continue;
          const target = board[nr2][nc2];
          if (target && target.color === enemy) {
            forked.push({ type: target.type, value: VAL[target.type] });
          }
        }
        
        // Score the fork
        if (forked.length >= 2) {
          const hasKing = forked.some(a => a.type === 'k');
          const hasQueen = forked.some(a => a.type === 'q');
          const hasRook = forked.some(a => a.type === 'r');
          const totalValue = forked.reduce((sum, a) => sum + a.value, 0);
          
          if (hasKing) {
            // Royal fork - king + another piece (often queen)
            score += turn === 'w' ? 600 : -600;
          } else if (hasQueen) {
            // Forking queen and another piece
            score += turn === 'w' ? 400 : -400;
          } else if (hasRook) {
            // Forking rook(s)
            score += turn === 'w' ? 250 : -250;
          } else {
            // Minor pieces fork
            score += turn === 'w' ? 150 : -150;
          }
        }
      }
    }
  }
  
  // Penalize if OUR pieces can be forked by enemy knights
  for (const row of board) {
    for (const p of row) {
      if (!p || p.type !== 'n' || p.color !== enemy) continue;
      
      const knightSq = p.square as Square;
      const { r, c } = idx(knightSq);
      const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      
      // Check where this enemy knight could move to fork us
      for (const [dr, dc] of knightMoves) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
        if (board[nr][nc]) continue;
        
        const forked: { type: PieceSymbol; value: number }[] = [];
        for (const [dr2, dc2] of knightMoves) {
          const nr2 = nr + dr2, nc2 = nc + dc2;
          if (nr2 < 0 || nr2 > 7 || nc2 < 0 || nc2 > 7) continue;
          const target = board[nr2][nc2];
          if (target && target.color === turn) {
            forked.push({ type: target.type, value: VAL[target.type] });
          }
        }
        
        if (forked.length >= 2) {
          const hasKing = forked.some(a => a.type === 'k');
          const hasQueen = forked.some(a => a.type === 'q');
          
          if (hasKing) {
            score += turn === 'w' ? -500 : 500;
          } else if (hasQueen) {
            score += turn === 'w' ? -350 : 350;
          } else {
            score += turn === 'w' ? -150 : 150;
          }
        }
      }
    }
  }
  
  return score;
}
export function bishopAttackBonus(chess: Chess): number {
  let score = 0;
  const board = chess.board();
  const turn = chess.turn();
  const enemy = turn === 'w' ? 'b' : 'w';
  
  // Find all enemy bishops
  for (const row of board) {
    for (const p of row) {
      if (!p || p.type !== 'b' || p.color !== enemy) continue;
      
      const bishopSq = p.square as Square;
      const { r, c } = idx(bishopSq);
      const diagDirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
      
      // Check what this bishop attacks
      for (const [dr, dc] of diagDirs) {
        for (let i = 1; i < 8; i++) {
          const nr = r + dr * i, nc = c + dc * i;
          if (nr < 0 || nr > 7 || nc < 0 || nc > 7) break;
          
          const target = board[nr][nc];
          if (!target) continue;
          
          if (target.color === turn) {
            // Our piece is attacked by enemy bishop
            // Check if it's defended
            const sq = target.square as Square;
            const defenders = countAttackers(chess, sq, turn);
            
            if (defenders === 0) {
              // Undefended piece on bishop's diagonal - hanging!
              score += turn === 'w' ? -200 : 200;
            }
          }
          
          if (target) break; // Stop at first piece
        }
      }
    }
  }
  
  // Bonus for OUR bishops attacking undefended pieces
  for (const row of board) {
    for (const p of row) {
      if (!p || p.type !== 'b' || p.color !== turn) continue;
      
      const bishopSq = p.square as Square;
      const { r, c } = idx(bishopSq);
      const diagDirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
      
      for (const [dr, dc] of diagDirs) {
        for (let i = 1; i < 8; i++) {
          const nr = r + dr * i, nc = c + dc * i;
          if (nr < 0 || nr > 7 || nc < 0 || nc > 7) break;
          
          const target = board[nr][nc];
          if (!target) continue;
          
          if (target.color === enemy) {
            const sq = target.square as Square;
            const defenders = countAttackers(chess, sq, enemy);
            
            if (defenders === 0) {
              // Undefended enemy piece on our bishop's diagonal
              score += turn === 'w' ? 150 : -150;
            }
          }
          
          if (target) break;
        }
      }
    }
  }
  
  return score;
}

/**
 * Detect pinned pieces - don't move pieces that are pinned to king/queen
 */
function detectPins(chess: Chess, turn: 'w' | 'b'): number {
  let score = 0;
  const board = chess.board();
  const enemy = turn === 'w' ? 'b' : 'w';
  
  // Find our pieces that might be pinned
  for (const row of board) {
    for (const p of row) {
      if (!p || p.color !== turn) continue;
      if (p.type === 'k') continue; // King can't be pinned
      
      const pieceSq = p.square as Square;
      const { r, c } = idx(pieceSq);
      
      // Check for diagonal pins (bishops/queens)
      const diagDirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
      for (const [dr, dc] of diagDirs) {
        if (isPinned(chess, pieceSq, dr, dc, ['b', 'q'], turn)) {
          score += turn === 'w' ? -150 : 150; // Penalty for having pinned piece
          break;
        }
      }
      
      // Check for straight pins (rooks/queens)
      const orthoDirs = [[-1,0],[1,0],[0,-1],[0,1]];
      for (const [dr, dc] of orthoDirs) {
        if (isPinned(chess, pieceSq, dr, dc, ['r', 'q'], turn)) {
          score += turn === 'w' ? -150 : 150;
          break;
        }
      }
    }
  }
  
  return score;
}

function isPinned(chess: Chess, pieceSq: Square, dirR: number, dirC: number, 
                 attackerTypes: PieceSymbol[], ourColor: 'w' | 'b'): boolean {
  const { r, c } = idx(pieceSq);
  let foundKing = false;
  let blocked = false;
  
  // Look toward our king first
  for (let i = 1; i < 8; i++) {
    const nr = r + dirR * i, nc = c + dirC * i;
    if (nr < 0 || nr > 7 || nc < 0 || nc > 7) break;
    
    const p = chess.board()[nr][nc];
    if (!p) continue;
    
    if (p.type === 'k' && p.color === ourColor) {
      foundKing = true;
      break;
    }
  }
  
  if (!foundKing) return false;
  
  // Now look the other direction for enemy attackers
  for (let i = 1; i < 8; i++) {
    const nr = r - dirR * i, nc = c - dirC * i;
    if (nr < 0 || nr > 7 || nc < 0 || nc > 7) break;
    
    const p = chess.board()[nr][nc];
    if (!p || p.color === ourColor) continue;
    
    if (attackerTypes.includes(p.type)) {
      return true; // Pinned!
    }
    blocked = true;
    break;
  }
  
  return false;
}

/**
 * Detect discovered attack potential
 */
function detectDiscoveredAttacks(chess: Chess, turn: 'w' | 'b'): number {
  let score = 0;
  const board = chess.board();
  const enemy = turn === 'w' ? 'b' : 'w';
  
  // Look for positions where moving a piece reveals an attack from bishop/rook/queen
  for (const row of board) {
    for (const p of row) {
      if (!p || p.color !== turn) continue;
      if (!['b', 'r', 'q'].includes(p.type)) continue;
      
      const pieceSq = p.square as Square;
      const dirs = p.type === 'b' ? [[-1,-1],[-1,1],[1,-1],[1,1]] :
                   p.type === 'r' ? [[-1,0],[1,0],[0,-1],[0,1]] :
                   [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]];
      
      for (const [dr, dc] of dirs) {
        let foundBlocker = false;
        for (let i = 1; i < 8; i++) {
          const nr = idx(pieceSq).r + dr * i;
          const nc = idx(pieceSq).c + dc * i;
          if (nr < 0 || nr > 7 || nc < 0 || nc > 7) break;
          
          const blocker = chess.board()[nr][nc];
          if (!blocker) continue;
          
          if (blocker.color === turn) {
            // Find a friendly piece blocking - if it moves, we discover attack
            foundBlocker = true;
            
            // Check if next square has valuable enemy
            const nextR = nr + dr, nextC = nc + dc;
            if (nextR >= 0 && nextR <= 7 && nextC >= 0 && nextC <= 7) {
              const target = chess.board()[nextR][nextC];
              if (target && target.color === enemy && VAL[target.type] >= 300) {
                // Discovered attack on valuable piece
                score += turn === 'w' ? 120 : -120;
              }
            }
          }
          
          if (blocker.color === enemy) {
            break;
          }
        }
      }
    }
  }
  
  return score;
}

/**
 * Detect skewers - royal pieces (king/queen) aligned where attacker can hit both
 */
function detectSkewers(chess: Chess, turn: 'w' | 'b'): number {
  let score = 0;
  const enemy = turn === 'w' ? 'b' : 'w';
  const board = chess.board();
  
  // Find aligned king and queen of same color
  let kingPos: { r: number; c: number } | null = null;
  let queenPos: { r: number; c: number } | null = null;
  
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== enemy) continue;
      if (p.type === 'k') kingPos = { r, c };
      if (p.type === 'q') queenPos = { r, c };
    }
  }
  
  if (kingPos && queenPos) {
    // Check if they're on same line/diagonal
    const dr = Math.sign(queenPos.r - kingPos.r);
    const dc = Math.sign(queenPos.c - kingPos.c);
    
    const onLine = dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc);
    
    if (onLine) {
      // Check if we have a piece that can attack along this line
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board[r][c];
          if (!p || p.color !== turn) continue;
          
          // Check if this piece attacks the line between king and queen
          if (p.type === 'q' || (p.type === 'b' && Math.abs(dr) === Math.abs(dc)) ||
              (p.type === 'r' && (dr === 0 || dc === 0))) {
            score += turn === 'w' ? 150 : -150; // Skewer opportunity
          }
        }
      }
    }
  }
  
  return score;
}

// Piece-square tables (white perspective; mirrored for black). Centipawns.
const PST: Record<PieceSymbol, number[]> = {
  p: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5,
      0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  n: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30,
      -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  b: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10,
      -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  r: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
      -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10,
      -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  k: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10,
      20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20]
};
const VALUE: Record<PieceSymbol, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

function pst(piece: PieceSymbol, color: 'w' | 'b', s: Square): number {
  const { r, c } = idx(s);
  const i = color === 'w' ? r * 8 + c : (7 - r) * 8 + c;
  return PST[piece][i];
}

/**
 * Material + piece-square score in centipawns from WHITE's view.
 * Deliberately does NOT probe for mate/draw: each of those checks generates
 * moves internally, which is far too expensive to run at every search node.
 */
export function rawEval(chess: Chess): number {
  let score = 0;
  const b = chess.board();
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = b[r][c]; if (!p) continue;
    const v = VALUE[p.type] + pst(p.type, p.color, p.square);
    score += p.color === 'w' ? v : -v;
  }
  return score;
}

// Static eval in centipawns from WHITE's view, terminal-aware.
export function evaluate(chess: Chess): number {
  if (chess.isCheckmate()) return chess.turn() === 'w' ? -100000 : 100000;
  if (chess.isDraw() || chess.isStalemate()) return 0;
  return rawEval(chess);
}

function negamax(chess: Chess, depth: number, alpha: number, beta: number): number {
  if (depth === 0 || chess.isGameOver()) {
    const e = evaluate(chess);
    return chess.turn() === 'w' ? e : -e; // side-to-move perspective
  }
  let best = -Infinity;
  for (const m of chess.moves({ verbose: true })) {
    chess.move(m);
    const val = -negamax(chess, depth - 1, -beta, -alpha);
    chess.undo();
    if (val > best) best = val;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export type Analysis = {
  bestMove?: Move; bestScore: number; playedScore: number;
  classification: 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
  explanation: string;
};

// Explain a move with heuristic, human-readable ideas.
export function explainMove(chess: Chess, m: Move): string {
  const ideas: string[] = [];
  const pieceName: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

  if (m.flags.includes('k') || m.flags.includes('q')) {
    ideas.push('Castles to safety');
  }

  if (m.captured) {
    ideas.push(`Captures a ${pieceName[m.captured] || m.captured}`);
  }

  if (m.piece === 'p' && ['d4', 'e4', 'd5', 'e5'].includes(m.to)) {
    ideas.push('Claims the center');
  }

  if (['n', 'b'].includes(m.piece) && (m.from[1] === '1' || m.from[1] === '8')) {
    ideas.push(`Develops the ${pieceName[m.piece]}`);
  }

  if (m.san.includes('#')) {
    ideas.push('Checkmate!');
  } else if (m.san.includes('+')) {
    ideas.push('Delivers check');
  }

  if (m.promotion) {
    ideas.push(`Promotes to ${pieceName[m.promotion] || m.promotion}`);
  }

  if (m.piece === 'k' && !m.flags.includes('k') && !m.flags.includes('q')) {
    ideas.push('King repositions');
  }

  if (m.piece === 'p' && !m.captured && !['d4', 'e4', 'd5', 'e5'].includes(m.to)) {
    const fromRank = parseInt(m.from[1], 10);
    const toRank = parseInt(m.to[1], 10);
    if (m.color === 'w' ? (toRank - fromRank >= 2) : (fromRank - toRank >= 2)) {
      ideas.push('Advances the pawn two squares');
    } else {
      ideas.push('Advances a pawn');
    }
  }

  if (!m.captured && !m.san.includes('+') && !m.san.includes('#')) {
    const board = chess.board();
    for (const row of board) {
      for (const cell of row) {
        if (cell && cell.color !== m.color && pieceAttacksSquare(chess, m.to, cell.square)) {
          ideas.push('Creates a threat');
          break;
        }
      }
      if (ideas.includes('Creates a threat')) break;
    }
  }

  if (['n', 'b'].includes(m.piece) && !(m.from[1] === '1' || m.from[1] === '8') && !m.captured) {
    const hasBetterIdea = ideas.some(i =>
      i.includes('Creates a threat') || i.includes('Delivers check') || i.includes('Checkmate'));
    if (!hasBetterIdea) {
      ideas.push(`Redeploys the ${pieceName[m.piece]}`);
    }
  }

  if (ideas.length === 0) ideas.push('Repositions');
  return ideas.join(' · ');
}

// Classify the move that was JUST played (chess is now in the post-move state).
// `fenBefore` = position before the move. We search there for the best reply.
export function analyzePlayedMove(fenBefore: string, played: Move, depth = 2): Analysis {
  const before = new Chess(fenBefore);
  const side = before.turn();
  // best move available before playing
  let bestMove: Move | undefined, bestScore = -Infinity;
  for (const m of before.moves({ verbose: true })) {
    before.move(m);
    const val = -negamax(before, depth - 1, -Infinity, Infinity);
    before.undo();
    if (val > bestScore) { bestScore = val; bestMove = m; }
  }
  // score of the move actually played (side-to-move perspective)
  const after = new Chess(fenBefore);
  after.move(played);
  const playedScore = (side === 'w' ? 1 : -1) * evaluate(after);

  const loss = bestScore - playedScore; // centipawns lost vs best
  let classification: Analysis['classification'] = 'best';
  if (loss > 300) classification = 'blunder';
  else if (loss > 150) classification = 'mistake';
  else if (loss > 70) classification = 'inaccuracy';
  else if (loss > 20) classification = 'good';

  return { bestMove, bestScore, playedScore, classification, explanation: explainMove(after, played) };
}

export type Weakness = 'opening' | 'tactics' | 'endgame' | 'kingSafety' | 'blunders';
export function classifyWeakness(chess: Chess, a: Analysis): Weakness | null {
  if (a.classification !== 'blunder' && a.classification !== 'mistake') return null;
  const ply = chess.history().length;
  if (ply <= 12) return 'opening';
  const b = chess.board();
  const majors = b.flat().filter(p => p && (p.type === 'q' || p.type === 'r')).length;
  if (majors <= 2) return 'endgame';
  if (chess.isCheck()) return 'kingSafety';
  if (a.bestMove?.captured) return 'tactics';
  return 'blunders';
}