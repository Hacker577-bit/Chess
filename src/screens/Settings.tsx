import { useEffect, useState } from 'react';
import { loadTheme, saveTheme } from '../lib/storage';
import type { Theme } from '../lib/storage';
import { setSound } from '../lib/sound';

export default function Settings() {
  const [theme, setTheme] = useState<Theme>(loadTheme());
  const [sound, setSnd] = useState(true);
  useEffect(() => { saveTheme(theme); }, [theme]);
  useEffect(() => { setSound(sound); }, [sound]);
  return (
    <div className="screen">
      <div className="card grid" style={{ gap: 14, maxWidth: 520 }}>
        <h2>Settings</h2>
        <div>
          <div className="muted" style={{ marginBottom: 8 }}>Board theme (colorblind-friendly options)</div>
          <div className="row">
            {(['classic','colorblind','minimal'] as Theme[]).map(t => (
              <button key={t} className={`btn ${theme===t?'primary':''}`} onClick={() => setTheme(t)}>{t}</button>
            ))}
          </div>
        </div>
        <label className="row"><input type="checkbox" checked={sound} onChange={e => setSnd(e.target.checked)} /> Sound (deep piece thud)</label>
        <p className="muted" style={{ fontSize: 12 }}>Everything runs offline. Install the app from the button in the corner for a native experience.</p>
      </div>
    </div>
  );
}