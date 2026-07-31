import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from './ChessBoard';
import { playUi } from '../lib/sound';

type Step = { from: string; to: string; caption: string; promotion?: string };
type Props = { title: string; desc: string; fen: string; steps: Step[]; accent?: string };

export default function LessonPlayer({ title, desc, fen, steps }: Props) {
  const chess = useMemo(() => new Chess(fen), [fen]);
  const [, force] = useState(0);
  const [i, setI] = useState(-1);
  const [last, setLast] = useState<{ from: any; to: any } | null>(null);
  const [anno, setAnno] = useState<{ square: any; text: string; key: number } | null>(null);
  const timer = useRef<number | null>(null);

  // reset when lesson changes
  useEffect(() => { chess.load(fen); setI(-1); setLast(null); setAnno(null); force(n => n + 1); }, [fen]);

  const step = () => {
    const next = i + 1;
    if (next >= steps.length) return;
    const s = steps[next];
    const m = chess.move({ from: s.from, to: s.to, promotion: s.promotion as any });
    if (!m) return;
    playUi();
    setLast({ from: s.from, to: s.to });
    setAnno({ square: s.to, text: s.caption, key: Date.now() });
    setI(next);
    force(n => n + 1);
  };
  const back = () => { chess.load(fen); for (let k = 0; k < i; k++) chess.move({ from: steps[k].from, to: steps[k].to, promotion: steps[k].promotion as any }); setI(i - 1); setLast(i > 0 ? { from: steps[i-1].from, to: steps[i-1].to } : null); force(n => n + 1); };

  // auto-play the demonstration
  useEffect(() => {
    timer.current = window.setTimeout(step, i === -1 ? 600 : 1500);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line
  }, [i, fen]);

  return (
    <div className="card grid" style={{ gap: 14 }}>
      <div>
        <h2>{title}</h2>
        <p className="muted" style={{ margin: 0 }}>{desc}</p>
      </div>
      <ChessBoard chess={chess} interactive={false} highlightLast={last} annotation={anno} />
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn" onClick={back} disabled={i < 0}>◀ Back</button>
        <button className="btn primary" onClick={step} disabled={i >= steps.length - 1}>
          {i >= steps.length - 1 ? 'Done ✓' : 'Next ▶'}
        </button>
      </div>
      <div className="muted" style={{ textAlign: 'center', fontSize: 13 }}>
        Step {Math.max(0, i + 1)} / {steps.length}
      </div>
    </div>
  );
}