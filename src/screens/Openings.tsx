// Openings.tsx
import { useState } from 'react';
import { OPENINGS } from '../data/openings';
import LessonPlayer from '../components/LessonPlayer';
export default function Openings() {
  const [i, setI] = useState(0); const o = OPENINGS[i];
  return (
    <div className="screen grid cols-2" style={{ alignItems: 'start' }}>
      <div className="card">
        <h2>Opening Explorer</h2>
        <p className="muted">Watch each line animate on the board with the idea behind every move.</p>
        <div className="grid" style={{ gap: 8 }}>
          {OPENINGS.map((x, idx) => (
            <div key={x.name} className="list-item" onClick={() => setI(idx)} style={{ cursor: 'pointer', outline: idx === i ? '2px solid var(--accent)' : 'none' }}>
              <div><h3>{x.name} <span className="pill">{x.eco}</span></h3><p>{x.desc} · {x.side}</p></div>
            </div>
          ))}
        </div>
      </div>
      <LessonPlayer key={o.name} title={o.name} desc={o.desc} fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
            steps={o.moves.map(m => ({ ...m, caption: (m as any).caption || '' }))} />
    </div>
  );
}