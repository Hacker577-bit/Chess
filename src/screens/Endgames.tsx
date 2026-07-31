// Endgames.tsx
import { useState } from 'react';
import { ENDGAMES } from '../data/lessons';
import LessonPlayer from '../components/LessonPlayer';
export default function Endgames() {
  const [i, setI] = useState(0); const l = ENDGAMES[i];
  return (
    <div className="screen grid cols-2" style={{ alignItems: 'start' }}>
      <div className="card">
        <h2>Endgame Technique</h2>
        <div className="grid" style={{ gap: 8 }}>
          {ENDGAMES.map((x, idx) => (
            <div key={x.id} className="list-item" onClick={() => setI(idx)} style={{ cursor: 'pointer', outline: idx === i ? '2px solid var(--accent)' : 'none' }}>
              <div><h3>{x.title}</h3><p>{x.desc}</p></div><span className="pill">{idx + 1}</span>
            </div>
          ))}
        </div>
      </div>
      <LessonPlayer key={l.id} title={l.title} desc={l.desc} fen={l.fen} steps={l.steps} />
    </div>
  );
}