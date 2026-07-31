import { Chess } from 'chess.js';
import type { Square } from 'chess.js';

const FILES = 'abcdefgh';
const rc = (s: Square) => ({ r: 8 - parseInt(s[1], 10), c: FILES.indexOf(s[0]) });
const sq = (r: number, c: number): Square | null =>
  (r < 0 || r > 7 || c < 0 || c > 7) ? null : ((FILES[c] + (8 - r)) as Square);

const KNIGHT = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const KING = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const DIAG = [[-1,-1],[-1,1],[1,-1],[1,1]];
const ORTH = [[-1,0],[1,0],[0,-1],[0,1]];

// Does the piece on `from` attack `to` (ignoring pins, respecting blockers)?
export function pieceAttacksSquare(chess: Chess, from: Square, to: Square): boolean {
  const p = chess.get(from); if (!p) return false;
  const a = rc(from), b = rc(to);
  const dr = b.r - a.r, dc = b.c - a.c;
  const occ = (r: number, c: number) => { const s = sq(r, c); return s ? chess.get(s) : undefined; };

  switch (p.type) {
    case 'p': {
      const dir = p.color === 'w' ? -1 : 1;
      return dr === dir && Math.abs(dc) === 1;
    }
    case 'n': return KNIGHT.some(([r, c]) => r === dr && c === dc);
    case 'k': return KING.some(([r, c]) => r === dr && c === dc);
    case 'b': return slide(a, b, DIAG, occ);
    case 'r': return slide(a, b, ORTH, occ);
    case 'q': return slide(a, b, DIAG, occ) || slide(a, b, ORTH, occ);
  }
  return false;
}

function slide(a: {r:number;c:number}, b: {r:number;c:number},
  dirs: number[][], occ: (r:number,c:number)=>any): boolean {
  const dr = Math.sign(b.r - a.r), dc = Math.sign(b.c - a.c);
  for (const [sr, sc] of dirs) {
    if (sr !== dr || sc !== dc) continue;
    let r = a.r + sr, c = a.c + sc;
    while (true) {
      if (r === b.r && c === b.c) return true;
      if (occ(r, c)) return false;       // blocked
      r += sr; c += sc;
      if (r < 0 || r > 7 || c < 0 || c > 7) break;
    }
  }
  return false;
}

// Count number of pieces of given color that attack a square
export function countAttackers(chess: Chess, targetSq: Square, attackerColor: 'w' | 'b'): number {
  let count = 0;
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== attackerColor) continue;
      const sq = p.square as Square;
      if (pieceAttacksSquare(chess, sq, targetSq)) count++;
    }
  }
  return count;
}

// Check if a square is attacked by any piece of given color
export function isSquareAttacked(chess: Chess, targetSq: Square, attackerColor: 'w' | 'b'): boolean {
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== attackerColor) continue;
      const sq = p.square as Square;
      if (pieceAttacksSquare(chess, sq, targetSq)) return true;
    }
  }
  return false;
}

// Squares of enemy pieces attacked by `from`, and friendly pieces defending `from`.
export function threatAndDefend(chess: Chess, from: Square) {
  const piece = chess.get(from); if (!piece) return { threats: [] as Square[], defends: [] as Square[] };
  const threats: Square[] = [], defends: Square[] = [];
  const board = chess.board();
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const cell = board[r][c]; if (!cell) continue;
    const s = cell.square;
    if (cell.color !== piece.color && pieceAttacksSquare(chess, from, s)) threats.push(s);
    if (cell.color === piece.color && s !== from && pieceAttacksSquare(chess, s, from)) defends.push(s);
  }
  return { threats, defends };
}