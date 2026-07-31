import { Chess } from 'chess.js';
import type { Move, PieceSymbol, Square } from 'chess.js';
import { rawEval, positionalBonus, pieceSafetyBonus, tacticalBonus, bishopAttackBonus } from './evaluation';
import { pieceAttacksSquare, countAttackers } from './attacks';

export type Level = 'beginner' | 'amateur' | 'intermediate' | 'grandmaster';

export type LevelConfig = {
  id: Level;
  label: string;
  rating: number;
  /** deepest ply iterative deepening will attempt */
  maxDepth: number;
  /** chance of ignoring the search entirely and playing a random legal move */
  blunderRate: number;
  /** centipawn window; any move within it of the best is a candidate */
  tolerance: number;
  /** wall-clock ceiling per move, so the UI can never lock up */
  budgetMs: number;
};

export const LEVELS: LevelConfig[] = [
  { id: 'beginner',     label: 'Beginner',     rating: 800,  maxDepth: 1, blunderRate: 0.35, tolerance: 120, budgetMs: 150 },
  { id: 'amateur',      label: 'Amateur',      rating: 1200, maxDepth: 2, blunderRate: 0.12, tolerance: 60,  budgetMs: 500 },
  { id: 'intermediate', label: 'Intermediate', rating: 1600, maxDepth: 4, blunderRate: 0,    tolerance: 0,   budgetMs: 3000 },
  { id: 'grandmaster',  label: 'Grandmaster',  rating: 2400, maxDepth: 5, blunderRate: 0,    tolerance: 0,   budgetMs: 5000 },
];

export const levelConfig = (id: Level): LevelConfig =>
  LEVELS.find(l => l.id === id) ?? LEVELS[1];

const MATE = 100_000;
const VAL: Record<PieceSymbol, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20_000 };

/**
 * Static Exchange Evaluation (SEE) — calculates the final material balance
 * after a complete capture sequence on a square, assuming both sides make
 * optimal exchanges. Returns the score from the moving side's perspective.
 * This is what real engines use to evaluate trades properly.
 */
function see(chess: Chess, move: Move): number {
  const to = move.to;
  const from = move.from;
  const movingPiece = move.piece;
  const capturedPiece = move.captured;

  if (!capturedPiece) return 0;

  // Initialize with captured piece value
  let gain = VAL[capturedPiece];
  let piece = movingPiece;

  // Temporarily make the move
  chess.move(move);

  // Build list of attackers at the destination square
  const enemy = chess.turn(); // now it's opponent's turn
  const board = chess.board();
  const attackers: { type: PieceSymbol; color: 'w' | 'b'; value: number }[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.square === to) continue;
      if (p.color !== enemy) continue;

      // Check if this piece attacks the 'to' square
      if (pieceAttacksSquare(chess, p.square, to)) {
        attackers.push({ type: p.type, color: p.color, value: VAL[p.type] });
      }
    }
  }

  // Sort attackers by value (cheapest first)
  attackers.sort((a, b) => a.value - b.value);

  // Simulate the exchange sequence
  let attackerValue = VAL[movingPiece];
  let defenderValue = VAL[capturedPiece];

  for (const attacker of attackers) {
    // Can we profitably continue the exchange?
    if (attackerValue < defenderValue) {
      gain = defenderValue - attackerValue;
      chess.undo();
      return gain;
    }

    // Exchange continues
    const temp = attackerValue;
    attackerValue = attacker.value;
    defenderValue = temp;

    // Negate the gain (opponent's turn)
    gain = -gain + defenderValue;
  }

  chess.undo();
  return gain;
}

/** Thrown to unwind the search when the time budget is spent. */
const TIMEOUT = Symbol('search-timeout');

let nodes = 0;
let deadline = 0;

/** 
 * Captures ordered by MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
 * plus SEE score. This is the standard ordering used by chess engines like
 * Stockfish — it ensures the bot considers the best trades first.
 * 
 * Also prioritizes castling and tactical moves.
 */
function ordered(moves: Move[], chess: Chess, depth: number): Move[] {
  const rank = (m: Move) => {
    let s = 0;

    // Primary: MVV-LVA — capturing high-value pieces with low-value attackers
    if (m.captured) {
      // MVV-LVA formula: victim_value * 10 - attacker_value
      s += VAL[m.captured] * 10 - VAL[m.piece];

      // Add SEE score for deeper evaluation of the trade
      if (depth >= 2) {
        s += see(chess, m);
      }
    }

    // Promotions are very valuable
    if (m.promotion) s += 900;

    // Castling - high priority for king safety
    if (m.flags.includes('k') || m.flags.includes('q')) {
      s += 300;
      
      // Extra bonus if castling out of check
      if (chess.inCheck()) s += 200;
      
      // Extra bonus if king has weak pawn shield
      const board = chess.board();
      const kingRow = m.color === 'w' ? 7 : 0;
      const kingCol = 4;
      let pawnShield = 0;
      const dir = m.color === 'w' ? -1 : 1;
      for (const df of [-1, 0, 1]) {
        const nr = kingRow + dir, nc = kingCol + df;
        if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
          const p = board[nr][nc];
          if (p && p.type === 'p' && p.color === m.color) pawnShield++;
        }
      }
      if (pawnShield < 2) s += 150;
    }

    // Checks can be tactically important
    if (m.san?.includes('+')) s += 40;

    // Fork moves (knight moves to center attacking multiple pieces)
    if (m.piece === 'n' && depth >= 1) {
      // Center squares are more valuable for knights
      const centerFiles = ['d', 'e'];
      const centerRanks = ['4', '5'];
      if (centerFiles.includes(m.to[0]) && centerRanks.includes(m.to[1])) {
        s += 30;
      }
    }

    return s;
  };
  return [...moves].sort((a, b) => rank(b) - rank(a));
}

/**
 * Extended quiescence search with SEE — continues through capture sequences
 * until the position is "quiet" (no more profitable captures). This prevents
 * the horizon effect where the engine misses a losing trade just beyond its
 * search depth.
 */
function quiesce(chess: Chess, alpha: number, beta: number, depth: number, evalFn: (c: Chess) => number = rawEval): number {
  const raw = evalFn(chess);
  const stand = chess.turn() === 'w' ? raw : -raw;

  // Standing_pat: if current position is already good enough, stop
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;

  // Only consider captures with positive or neutral SEE score
  // This ensures the bot doesn't continue losing exchanges
  const captures = chess.moves({ verbose: true }).filter(x => x.captured);
  const goodCaptures = captures.filter(m => see(chess, m) >= 0);

  for (const m of ordered(goodCaptures, chess, depth)) {
    chess.move(m);
    let v: number;
    try {
      v = -quiesce(chess, -beta, -alpha, depth - 1, evalFn);
    } finally {
      chess.undo();
    }
    if (v >= beta) return beta;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

/**
 * Negamax with alpha-beta, scored from the side to move.
 * `ply` makes mate scores prefer the *fastest* mate rather than any mate.
 *
 * Terminal state is derived from the single move list we already generated —
 * probing chess.js for mate/draw per node costs more than the search itself.
 */
function search(chess: Chess, depth: number, alpha: number, beta: number, ply: number, evalFn: (c: Chess) => number = rawEval): number {
  // chess.js verbose move generation costs ~1-2ms per node, so the deadline has
  // to be sampled often or a "350ms" budget overshoots into seconds.
  if ((++nodes & 63) === 0 && Date.now() > deadline) throw TIMEOUT;

  const moves = chess.moves({ verbose: true });
  if (!moves.length) return chess.isCheck() ? -MATE + ply : 0; // mate or stalemate
  if (depth <= 0) return quiesce(chess, alpha, beta, 3, evalFn);

  let best = -Infinity;
  for (const m of ordered(moves, chess, depth)) {
    chess.move(m);
    let v: number;
    try {
      v = -search(chess, depth - 1, -beta, -alpha, ply + 1, evalFn);
    } finally {
      chess.undo(); // must unwind even on TIMEOUT, or the board is corrupted
    }
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break; // fail-high
  }
  return best;
}

/**
 * Pick a move for the given difficulty.
 * 
 * Difficulty layering:
 * - Beginner: Random blunders, shallow search
 * - Amateur: Beginner + reduced blunders, basic search
 * - Intermediate: Amateur + NO blunders, SEE trades, hanging piece detection
 * - Grandmaster: Intermediate + positional play, king safety, pawn structure
 */
export function chooseMove(chess: Chess, level: Level): Move | null {
  const cfg = levelConfig(level);
  const moves = chess.moves({ verbose: true });
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];

  // Build evaluation function based on level
  // Each level includes all features of lower levels
  const useSafety = level === 'intermediate' || level === 'grandmaster';
  const useTactical = level === 'intermediate' || level === 'grandmaster';
  const usePositional = level === 'grandmaster';

  const evalFn: (c: Chess) => number = (chess) => {
    let score = rawEval(chess);
    
    // Safety: No hanging pieces, defend material
    if (useSafety) {
      score += pieceSafetyBonus(chess);
    }
    
    // Tactical: Castling, forks, pins, discovered attacks, bishop threats
    if (useTactical) {
      score += tacticalBonus(chess);
      score += bishopAttackBonus(chess);
    }
    
    // Positional: King safety, piece coordination, pawn structure (GM only)
    if (usePositional) {
      score += positionalBonus(chess);
    }
    
    return score;
  };

  // Beginner and Amateur have chance to blunder
  if (cfg.blunderRate > 0 && Math.random() < cfg.blunderRate) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  // Intermediate and Grandmaster: Filter out moves that hang pieces or lose trades
  // This is a hard filter applied BEFORE search
  if (useSafety) {
    const safeMoves = moves.filter(m => {
      chess.move(m);
      const hangsPiece = !moveHangsPiece(chess, m);
      chess.undo();
      
      // Also check SEE - don't make losing trades
      let badTrade = false;
      if (m.captured) {
        const seeScore = see(chess, m);
        badTrade = seeScore < 0; // Move loses material in the exchange
      }
      
      return hangsPiece && !badTrade;
    });
    
    // If all moves are bad, at least pick from moves that don't hang pieces
    const nonHangingMoves = moves.filter(m => {
      chess.move(m);
      const isSafe = !moveHangsPiece(chess, m);
      chess.undo();
      return isSafe;
    });
    
    const candidateMoves = safeMoves.length > 0 ? safeMoves : (nonHangingMoves.length > 0 ? nonHangingMoves : moves);
    
    return searchBestMove(candidateMoves, chess, cfg, evalFn);
  }

  return searchBestMove(moves, chess, cfg, evalFn);
}

/**
 * Check if a move leaves any of our pieces hanging (undefended and attacked)
 * After making the move, it's the opponent's turn, so we check if THEY can
 * capture any of our pieces for free or with advantage.
 */
function moveHangsPiece(chess: Chess, lastMove: Move): boolean {
  const board = chess.board();
  const us = chess.turn() === 'w' ? 'b' : 'w'; // Our color (opponent is now side to move)
  const them = chess.turn(); // Opponent's color, side to move
  
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== us) continue; // Check only our pieces
      
      const sq = p.square as Square;
      const pieceValue = VAL[p.type];
      
      // Count how many of opponent's pieces attack this square
      const attackers = countAttackers(chess, sq, them);
      // Count how many of our pieces defend this square
      const defenders = countAttackers(chess, sq, us);
      
      // Piece is hanging if:
      // 1. Attacked and completely undefended
      // 2. Attackers > defenders (will lose material in exchange)
      // 3. Attacked by lower value piece (profitable capture for opponent)
      if (attackers > 0) {
        if (defenders === 0) {
          // Completely undefended - definitely hanging
          return true;
        }
        if (attackers > defenders) {
          // Outnumbered - will lose the piece
          return true;
        }
      }
    }
  }
  
  // Also check if the moved piece itself is now under attack
  const movedPiece = chess.get(lastMove.to);
  if (movedPiece) {
    const attackers = countAttackers(chess, lastMove.to, them);
    const defenders = countAttackers(chess, lastMove.to, us);
    if (attackers > 0 && defenders === 0) {
      return true;
    }
  }
  
  return false;
}

/**
 * Standard alpha-beta search to find the best move
 */
function searchBestMove(
  moves: Move[], 
  chess: Chess, 
  cfg: LevelConfig, 
  evalFn: (c: Chess) => number
): Move {
  nodes = 0;
  deadline = Date.now() + cfg.budgetMs;

  // Iterative deepening with proper move ordering
  let order = ordered(moves, chess, cfg.maxDepth);
  let best: { m: Move; v: number }[] = order.map(m => ({ m, v: 0 }));

  for (let depth = 1; depth <= cfg.maxDepth; depth++) {
    const scored: { m: Move; v: number }[] = [];
    try {
      let alpha = -Infinity;
      for (const m of order) {
        if (Date.now() > deadline) throw TIMEOUT;
        chess.move(m);
        let v: number;
        try {
          const beta = cfg.tolerance > 0 ? Infinity : -alpha;
          v = -search(chess, depth - 1, -Infinity, beta, 1, evalFn);
        } finally {
          chess.undo();
        }
        scored.push({ m, v });
        if (v > alpha) alpha = v;
      }
    } catch (e) {
      if (e !== TIMEOUT) throw e;
      break;
    }
    scored.sort((a, b) => b.v - a.v);
    best = scored;
    order = scored.map(s => s.m);
    if (Math.abs(best[0].v) > MATE - 100) break;
  }

  const cutoff = best[0].v - cfg.tolerance;
  const pool = best.filter(s => s.v >= cutoff);
  return pool[Math.floor(Math.random() * pool.length)].m;
}
