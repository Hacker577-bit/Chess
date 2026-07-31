import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Square, Move, Color, PieceSymbol } from 'chess.js';
import { threatAndDefend } from '../lib/attacks';
import { playMove } from '../lib/sound';
import pieceSprite from '../assets/pieces.svg?raw';

const FILES = 'abcdefgh';
const rc = (s: Square) => ({ r: 8 - parseInt(s[1], 10), c: FILES.indexOf(s[0]) });
const sqName = (r: number, c: number): Square => (FILES[c] + (8 - r)) as Square;

type Tracked = { id: number; type: PieceSymbol; color: Color; square: Square; captured?: boolean };

let UID = 1;

// Cburnett/Rfc1394 Staunton pieces (CC BY-SA 3.0), bundled via cm-chessboard.
// The sprite keeps its licence header; it is injected once and referenced by <use>.
let spriteInjected = false;
function injectSprite() {
  if (spriteInjected || typeof document === 'undefined') return;
  spriteInjected = true;
  const host = document.createElement('div');
  host.style.display = 'none';
  host.setAttribute('aria-hidden', 'true');
  host.innerHTML = pieceSprite;
  document.body.prepend(host);
}

/**
 * Renders a piece from the bundled Cburnett sprite.
 * Sprite ids are `<colour><type>` (wk, bq, …) on a 40×40 canvas.
 */
function PieceArt({ type, color }: { type: PieceSymbol; color: Color }) {
  injectSprite();
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className="piece-svg">
      <use href={`#${color}${type}`} />
    </svg>
  );
}

export type Arrow = { from: Square; to: Square; color?: string };

type Props = {
  chess: Chess;                       // owned by parent; board mutates via onMove
  orientation?: Color;
  interactive?: boolean;              // allow the side-to-move to move
  onMove?: (m: Move) => void;         // called after a successful move
  highlightLast?: { from: Square; to: Square } | null;
  arrows?: Arrow[];                   // e.g. better-move replay
  annotation?: { square: Square; text: string; key: number } | null;
  slowMo?: boolean;                   // slow-motion replay
  showThreats?: boolean;
};

export type BoardHandle = {
  /** Apply a move through the same animated path a human move uses. */
  applyMove: (from: Square, to: Square, promotion?: PieceSymbol) => void;
};

const ChessBoard = forwardRef<BoardHandle, Props>(function ChessBoard({
  chess, orientation = 'w', interactive = true, onMove,
  highlightLast, arrows = [], annotation, slowMo = false, showThreats = true
}, ref) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [pieces, setPieces] = useState<Tracked[]>(() => buildFromChess(chess));
  const [selected, setSelected] = useState<Square | null>(null);
  const [legal, setLegal] = useState<Move[]>([]);
  const [hover, setHover] = useState<Square | null>(null);
  const [drag, setDrag] = useState<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const [dropping, setDropping] = useState<number | null>(null);
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);
  const prevFen = useRef(chess.fen());

  // Re-sync tracked pieces when parent replaces the position (lessons / undo / replay)
  useEffect(() => {
    if (chess.fen() !== prevFen.current) {
      setPieces(buildFromChess(chess));
      setSelected(null); setLegal([]);
      prevFen.current = chess.fen();
    }
  }, [chess, chess.fen()]);

  function buildFromChess(c: Chess): Tracked[] {
    const out: Tracked[] = [];
    const b = c.board();
    for (let r = 0; r < 8; r++) for (let col = 0; col < 8; col++) {
      const p = b[r][col]; if (!p) continue;
      out.push({ id: UID++, type: p.type, color: p.color, square: p.square });
    }
    return out;
  }

  // ---- commit a move with full tracking of captures / castle / en-passant / promo ----
  function commit(from: Square, to: Square, promotion?: PieceSymbol) {
    const mover = pieces.find(p => p.square === from && !p.captured);
    if (!mover) return;
    const moveObj = chess.moves({ square: from, verbose: true }).find(m => m.to === to && (!m.promotion || m.promotion === promotion));
    if (!moveObj) return;

    const flags = moveObj.flags;
    const capturedSq: Square | null =
      flags.includes('e') ? (sqName(rc(to).r + (chess.turn() === 'w' ? 1 : -1), rc(to).c)) :
      moveObj.captured ? to : null;

    // apply to engine
    const applied = chess.move({ from, to, promotion: promotion || (moveObj.promotion as any) });
    if (!applied) return;
    prevFen.current = chess.fen();

    // update tracked set
    setPieces(prev => {
      let next = prev.map(p => ({ ...p }));
      // Find and mark the captured piece BEFORE updating the mover's square.
      // Otherwise both mover and captured piece share the same square (to)
      // and find() may incorrectly target the mover.
      if (capturedSq) {
        const cap = next.find(p => p.square === capturedSq && !p.captured);
        if (cap) cap.captured = true;
      }
      const m = next.find(p => p.id === mover.id)!;
      m.square = to;
      if (moveObj.promotion) m.type = (promotion || 'q') as PieceSymbol;
      // castling rook
      if (flags.includes('k') || flags.includes('q')) {
        const rank = from[1];
        const rookFrom = (flags.includes('k') ? ('h' + rank) : ('a' + rank)) as Square;
        const rookTo = (flags.includes('k') ? ('f' + rank) : ('d' + rank)) as Square;
        const rook = next.find(p => p.square === rookFrom && !p.captured);
        if (rook) rook.square = rookTo;
      }
      return next;
    });

    // sound fires on impact; timings match the .12s glide in CSS
    playMove({ capture: !!moveObj.captured, check: chess.isCheck(), castle: flags.includes('k') || flags.includes('q') });
    setDropping(mover.id);
    setTimeout(() => setDropping(d => (d === mover.id ? null : d)), 130);

    // purge captured pieces once the short fade completes
    setTimeout(() => setPieces(prev => prev.filter(p => !p.captured)), 140);

    setSelected(null); setLegal([]);
    onMove?.(applied);
  }

  // Let the parent (bot / scripted replay) push a move through the animated path.
  useImperativeHandle(ref, () => ({
    applyMove: (from, to, promotion) => commit(from, to, promotion),
  }));

  // ---- selection ----
  function select(s: Square) {
    if (!interactive) return;
    const p = chess.get(s);
    if (!p || p.color !== chess.turn()) { setSelected(null); setLegal([]); return; }
    setSelected(s);
    setLegal(chess.moves({ square: s, verbose: true }));
  }

  function onSquareClick(s: Square) {
    if (!interactive) return;
    if (selected) {
      const match = legal.filter(m => m.to === s);
      if (match.length) {
        if (match.some(m => m.promotion)) { setPromo({ from: selected, to: s }); return; }
        commit(selected, s); return;
      }
      // reselect own piece
      const p = chess.get(s);
      if (p && p.color === chess.turn()) { select(s); return; }
      setSelected(null); setLegal([]); return;
    }
    select(s);
  }

  // ---- pointer drag (also handles tap) ----
  const dragStart = useRef<{ id: number; sq: Square; moved: boolean } | null>(null);
  const dragOrigin = useRef<{ x: number; y: number } | null>(null);
  function onPieceDown(e: React.PointerEvent, p: Tracked) {
    if (!interactive) return;
    // Pieces render above the squares layer, so a pointer-down on an enemy piece
    // must be routed to the square handler — otherwise click-to-capture dies here.
    if (p.color !== chess.turn()) { onSquareClick(p.square); return; }
    (e.target as Element).setPointerCapture?.(e.pointerId);
    select(p.square);
    dragStart.current = { id: p.id, sq: p.square, moved: false };
    const rect = boardRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    dragOrigin.current = { x, y };
    setDrag({ id: p.id, x, y, moved: false });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const origin = dragOrigin.current;
    // measure against where the press began, not the previous frame
    const moved = drag.moved ||
      (!!origin && Math.abs(x - origin.x) + Math.abs(y - origin.y) > 4);
    if (moved && dragStart.current) dragStart.current.moved = true;
    setDrag({ id: drag.id, x, y, moved });
  }
  function onPointerUp(e: React.PointerEvent) {
    dragOrigin.current = null;
    if (!drag || !boardRef.current || !dragStart.current) { setDrag(null); return; }
    const rect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const col = Math.floor((x / rect.width) * 8);
    const row = Math.floor((y / rect.height) * 8);
    const target = (row >= 0 && row < 8 && col >= 0 && col < 8) ? sqName(row, col) : null;
    const start = dragStart.current;
    setDrag(null);
    if (!start.moved) { dragStart.current = null; return; } // it was a tap → selection already set
    if (target && target !== start.sq) {
      const match = legal.filter(m => m.to === target);
      if (match.length) {
        if (match.some(m => m.promotion)) { setPromo({ from: start.sq, to: target }); dragStart.current = null; return; }
        commit(start.sq, target);
      }
    }
    dragStart.current = null;
  }

  // ---- derived visuals ----
  const legalTo = useMemo(() => new Set(legal.map(m => m.to)), [legal]);
  const captureTo = useMemo(() => new Set(legal.filter(m => m.captured).map(m => m.to)), [legal]);
  const threats = useMemo(() => {
    if (!showThreats || !hover) return { t: new Set<Square>(), d: new Set<Square>() };
    const { threats, defends } = threatAndDefend(chess, hover);
    return { t: new Set(threats), d: new Set(defends) };
  }, [hover, chess, showThreats]);

  const flipped = orientation === 'b';
  const rows = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  const cols = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];

  const inCheckSq: Square | null = chess.isCheck()
    ? (chess.board().flat().find(p => p && p.type === 'k' && p.color === chess.turn())?.square ?? null)
    : null;

  const pieceStyle = (p: Tracked): React.CSSProperties => {
    // Only follow the pointer once it has actually moved — a plain click must
    // leave the piece sitting on its square.
    if (drag && drag.id === p.id && drag.moved && boardRef.current) {
      const squarePx = boardRef.current.clientWidth / 8;
      // translate() percentages resolve against the piece's own box (one square),
      // so centring on the pointer is (offset / squarePx * 100) - 50.
      const x = (drag.x / squarePx) * 100 - 50;
      const y = (drag.y / squarePx) * 100 - 50;
      return { transform: `translate(${x}%, ${y}%)`, transition: 'none' };
    }
    const { r, c } = rc(p.square);
    const col = flipped ? 7 - c : c;
    const row = flipped ? 7 - r : r;
    return { transform: `translate(${col * 100}%, ${row * 100}%)`, transitionDuration: slowMo ? '1.4s' : undefined };
  };

  return (
    <div className="board-wrap">
      <div
        className="board"
        ref={boardRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div className="squares">
          {rows.map(r => cols.map(c => {
            const s = sqName(r, c);
            const isLight = (r + c) % 2 === 0;
            const cls = [
              'sq', isLight ? 'light' : 'dark',
              selected === s ? 'selected' : '',
              highlightLast && (highlightLast.from === s || highlightLast.to === s) ? 'lastmove' : '',
              inCheckSq === s ? 'check' : '',
              legalTo.has(s) ? 'dot-host' : '',
              captureTo.has(s) ? 'capture' : '',
              threats.t.has(s) ? 'threat' : '',
              threats.d.has(s) ? 'defend' : ''
            ].join(' ');
            // files along the bottom edge, ranks along the left edge (both orientations)
            const showFile = flipped ? r === 0 : r === 7;
            const showRank = flipped ? c === 7 : c === 0;
            return (
              <div key={s} className={cls} onClick={() => onSquareClick(s)}
                   onPointerEnter={() => setHover(s)} onPointerLeave={() => setHover(h => (h === s ? null : h))}>
                {showFile && <span className="coord file">{FILES[c]}</span>}
                {showRank && <span className="coord rank">{8 - r}</span>}
                {legalTo.has(s) && <span className="dot" />}
              </div>
            );
          }))}
        </div>

        <div className="pieces">
          {pieces.map(p => (
            <div
              key={p.id}
              className={`piece ${p.color} ${p.captured ? 'captured' : ''} ${drag?.id === p.id && drag.moved ? 'dragging' : ''} ${dropping === p.id ? 'dropping' : ''}`}
              style={pieceStyle(p)}
              onPointerDown={(e) => onPieceDown(e, p)}
            >
              <PieceArt type={p.type} color={p.color} />
            </div>
          ))}
        </div>

        {arrows.length > 0 && (
          <svg className="arrows" viewBox="0 0 8 8" preserveAspectRatio="none">
            {arrows.map((a, i) => {
              const A = rc(a.from), B = rc(a.to);
              const x1 = (flipped ? 7 - A.c : A.c) + 0.5, y1 = (flipped ? 7 - A.r : A.r) + 0.5;
              const x2 = (flipped ? 7 - B.c : B.c) + 0.5, y2 = (flipped ? 7 - B.r : B.r) + 0.5;
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={a.color || '#46c08a'}
                           strokeWidth={0.14} strokeLinecap="round" opacity={0.9}
                           style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,.5))' }} />;
            })}
          </svg>
        )}

        {annotation && (
          <div className="annotation" key={annotation.key}
               style={{ left: `${((flipped ? 7 - rc(annotation.square).c : rc(annotation.square).c) + 0.5) * 12.5}%`,
                        top: `${((flipped ? 7 - rc(annotation.square).r : rc(annotation.square).r) + 0.5) * 12.5}%` }}>
            {annotation.text}
          </div>
        )}
      </div>

      {promo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center', zIndex: 60 }}
             onClick={() => setPromo(null)}>
          <div className="card row" onClick={e => e.stopPropagation()}>
            {(['q','r','b','n'] as PieceSymbol[]).map(t => (
              <button key={t} className="btn" style={{ fontSize: 40, padding: '6px 12px' }}
                      onClick={() => { commit(promo.from, promo.to, t); setPromo(null); }}>
                <span style={{ display: 'inline-grid', width: 44, height: 44 }}>
                  <PieceArt type={t} color={chess.turn()} />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default ChessBoard;