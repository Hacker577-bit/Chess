import { useEffect, useState } from 'react';
import Home from './screens/Home';
import Play from './screens/Play';
import Learn from './screens/Learn';
import Practice from './screens/Practice';
import Openings from './screens/Openings';
import Endgames from './screens/Endgames';
import Settings from './screens/Settings';
import InstallButton from './components/InstallButton';
import { loadTheme, saveTheme } from './lib/storage';
import { unlockAudio } from './lib/sound';

type Screen = 'home' | 'play' | 'learn' | 'practice' | 'openings' | 'endgames' | 'settings';
const TABS: { id: Screen; label: string }[] = [
  { id: 'home', label: 'Home' }, { id: 'play', label: 'Play' }, { id: 'learn', label: 'Learn' },
  { id: 'practice', label: 'Practice' }, { id: 'openings', label: 'Openings' },
  { id: 'endgames', label: 'Endgames' }, { id: 'settings', label: '⚙' }
];

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  useEffect(() => { saveTheme(loadTheme()); }, []);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      document.documentElement.setAttribute('data-reduced-motion', '1');
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
  }, []);

  return (
    <div className="app">
      <nav className="nav">
        <span className="brand">♛ Chess</span>
        {TABS.map(t => (
          <button key={t.id} className={`tab ${screen===t.id?'active':''}`} onClick={() => setScreen(t.id)}>{t.label}</button>
        ))}
        <span className="spacer" />
      </nav>

      {screen === 'home' && <Home go={(s) => setScreen(s as Screen)} />}
      {screen === 'play' && <Play />}
      {screen === 'learn' && <Learn />}
      {screen === 'practice' && <Practice />}
      {screen === 'openings' && <Openings />}
      {screen === 'endgames' && <Endgames />}
      {screen === 'settings' && <Settings />}

      <InstallButton />
    </div>
  );
}