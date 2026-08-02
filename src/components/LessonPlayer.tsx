import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from './ChessBoard';
import { playUi } from '../lib/sound';

type Step = { from: string; to: string; caption: string; promotion?: string };
type Props = { title: string; desc: string; fen: string; steps: Step[]; accent?: string };

export default function LessonPlayer({ title, desc, fen, steps }: Props) {
  const chess = useMemo(() => new Chess(fen), [fen]);
  const [, force] = useState(0);
  const [i, setI] = useState(-1);            // index of the last applied move, -1 = starting position
  const [furthest, setFurthest] = useState(-1); // furthest move reached (used as "current position")
  const [last, setLast] = useState<{ from: any; to: any } | null>(null);
  const [anno, setAnno] = useState<{ square: any; text: string; key: number } | null>(null);
  const [auto, setAuto] = useState(true);
  const timer = useRef<number | null>(null);

  // reset when lesson changes
  useEffect(() => { chess.load(fen); setI(-1); setFurthest(-1); setLast(null); setAnno(null); setAuto(true); force(n => n + 1); }, [fen]);

  // Rebuild the board at the position reached after step `idx` (0-based).
  function applyTo(idx: number): boolean {
    chess.load(fen);
    for (let k = 0; k <= idx; k++) {
      if (!chess.move({ from: steps[k].from, to: steps[k].to, promotion: steps[k].promotion as any })) return false;
    }
    return true;
  }

  function goTo(idx: number, keepAuto: boolean) {
    if (idx < -1 || idx >= steps.length) return;
    if (!keepAuto) setAuto(false);
    if (idx >= 0) {
      if (!applyTo(idx)) return;
      const s = steps[idx];
      setLast({ from: s.from, to: s.to });
      setAnno({ square: s.to, text: s.caption, key: Date.now() });
    } else {
      chess.load(fen);
      setLast(null); setAnno(null);
    }
    setI(idx);
    setFurthest(f => Math.max(f, idx));
    force(n => n + 1);
  }

  // auto-play the demonstration until it reaches the end
  useEffect(() => {
    if (!auto || i >= steps.length - 1) return;
    timer.current = window.setTimeout(() => { goTo(i + 1, true); playUi(); }, i === -1 ? 600 : 1500);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line
  }, [i, auto, fen]);

  const prev = () => goTo(i - 1, false);
  const next = () => goTo(i + 1, false);
  const toCurrent = () => goTo(furthest, false);

  return (
    <div className="card grid" style={{ gap: 14 }}>
      <div>
        <h2>{title}</h2>
        <p className="muted" style={{ margin: 0 }}>{desc}</p>
      </div>
      <ChessBoard chess={chess} interactive={false} highlightLast={last} annotation={anno} />
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn" onClick={prev} disabled={i <= -1}>◀ Prev move</button>
        <button className="btn primary" onClick={next} disabled={i >= steps.length - 1}>
          {i >= steps.length - 1 ? 'Done ✓' : 'Next ▶'}
        </button>
        <button className="btn" onClick={toCurrent} disabled={i >= furthest}>Current position</button>
      </div>
      <div className="muted" style={{ textAlign: 'center', fontSize: 13 }}>
        Step {Math.max(0, i + 1)} / {steps.length}
      </div>
    </div>
  );
}
