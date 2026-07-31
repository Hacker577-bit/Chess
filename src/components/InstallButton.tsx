import { useState } from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

function browserHints(): string[] {
  const ua = navigator.userAgent;
  if (/edg\//i.test(ua)) {
    return ['Click the ⋯ menu (top right)', 'Choose "Apps and sites" → "Install this site as an app"'];
  }
  if (/chrome|crios/i.test(ua)) {
    return ['Click the ⋮ menu (top right)', 'Choose "Cast, save, and share" → "Install page as app…"', 'Or click the download icon in the address bar'];
  }
  if (/firefox/i.test(ua)) {
    return ['Click the ☰ menu (top right)', 'Look for "Install App" or choose "Add to Home Screen"'];
  }
  if (/safari|iphone|ipad/i.test(ua)) {
    return ['Tap the Share button', 'Choose "Add to Home Screen"'];
  }
  return ['Open your browser menu', 'Look for "Install App" or "Add to Home Screen"'];
}

export default function InstallButton() {
  const { canInstall, installed, promptInstall } = useInstallPrompt();
  const [showHelp, setShowHelp] = useState(false);
  if (installed) return null;

  const handleClick = () => {
    if (canInstall) { promptInstall(); return; }
    setShowHelp(true);
  };

  return (
    <>
      <button className="install" onClick={handleClick}>⬇ Install App</button>
      {showHelp && (
        <div className="install-overlay" onClick={() => setShowHelp(false)}>
          <div className="card install-modal" onClick={e => e.stopPropagation()}>
            <h3>Install Chess on your PC</h3>
            <ol>
              {browserHints().map((h, i) => <li key={i}>{h}</li>)}
            </ol>
            <button className="btn primary" onClick={() => setShowHelp(false)}>Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
