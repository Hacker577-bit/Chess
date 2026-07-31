import { useInstallPrompt } from '../hooks/useInstallPrompt';

export default function InstallButton() {
  const { canInstall, installed, showIOSHint, promptInstall } = useInstallPrompt();
  if (installed) return null;

  const handleClick = () => {
    if (canInstall) { promptInstall(); return; }
    if (showIOSHint) {
      alert('Tap the Share icon, then "Add to Home Screen" to install Chess.');
      return;
    }
    alert('To install Chess, open your browser menu (⋯) and choose "Install App" or "Add to Home Screen".');
  };

  return <button className="install" onClick={handleClick}>⬇ Install App</button>;
}