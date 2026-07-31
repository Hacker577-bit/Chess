export default function Home({ go }: { go: (s: string) => void }) {
  const onMove = (e: React.MouseEvent) => {
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  return (
    <div className="screen">
      <div className="hero" onMouseMove={onMove}>
        <img src="/hero.png" alt="Triumphant queen over a fallen king" />
        <div className="glow" />
        <div className="copy">
          <h1>Master the Game.</h1>
          <p className="muted">Play, learn, and train — fully offline, beautifully crafted.</p>
          <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
            <button className="btn primary" onClick={() => go('play')}>Play</button>
            <button className="btn" onClick={() => go('learn')}>Learn</button>
          </div>
        </div>
      </div>
      <div className="grid cols-2">
        <div className="card"><h2>🎯 Smart Coaching</h2><p className="muted">Move explanations, blunder replay & a personalized weakness tracker.</p></div>
        <div className="card"><h2>📚 Openings & Endgames</h2><p className="muted">Animated lessons for the London, French, QGD, Sicilian & more.</p></div>
        <div className="card"><h2>📶 Offline-First</h2><p className="muted">Install it once — play anywhere with zero connection.</p></div>
        <div className="card"><h2>♿ Accessible</h2><p className="muted">Colorblind themes & reduced-motion support built in.</p></div>
      </div>
    </div>
  );
}