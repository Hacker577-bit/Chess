import { useInstallPrompt } from '../hooks/useInstallPrompt';

export default function InstallButton() {
  const { canInstall, installed, showIOSHint, promptInstall } = useInstallPrompt();
  if (installed) return null;
  if (showIOSHint) {
    return (
      <button className="install" onClick={() => alert('Tap the Share icon, then "Add to Home Screen" to install Chess.')}>
        ⬇ Install App
      </button>
    );
  }
  if (!canInstall) return null; // browser unsupported or already shown → stay unobtrusive
  return <button className="install" onClick={promptInstall}>⬇ Install App</button>;
}