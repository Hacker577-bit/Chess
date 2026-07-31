// Web Audio synthesis: a deep, low "wood + felt" thunk for real piece movement.
let ctx: AudioContext | null = null;
let enabled = true;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlockAudio() { ac(); }
export function setSound(on: boolean) { enabled = on; }

function noiseBuffer(c: AudioContext, seconds: number) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  return buf;
}

// Deep body thud (sine sweep 90→45 Hz) + felt knock (filtered noise).
function thud(c: AudioContext, t: number, gain: number, baseFreq: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(baseFreq, t);
  o.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, t + 0.22);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + 0.35);

  // second harmonic for "weight"
  const o2 = c.createOscillator();
  const g2 = c.createGain();
  o2.type = 'triangle';
  o2.frequency.setValueAtTime(baseFreq * 1.5, t);
  o2.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, t + 0.18);
  g2.gain.setValueAtTime(0.0001, t);
  g2.gain.exponentialRampToValueAtTime(gain * 0.5, t + 0.006);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o2.connect(g2).connect(c.destination);
  o2.start(t); o2.stop(t + 0.25);
}

function knock(c: AudioContext, t: number, gain: number) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 0.12);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.7;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.10);
  src.connect(lp).connect(g).connect(c.destination);
  src.start(t); src.stop(t + 0.12);
}

export function playMove(opts: { capture?: boolean; check?: boolean; castle?: boolean } = {}) {
  if (!enabled) return;
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const base = opts.capture ? 70 : opts.castle ? 78 : 92;
  thud(c, t, 0.9, base);
  knock(c, t, opts.capture ? 0.5 : 0.32);
  if (opts.capture) { thud(c, t + 0.02, 0.6, 55); }
  if (opts.check) {
    const o = c.createOscillator(); const g = c.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(660, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.2);
  }
}

export function playCheckmate() {
  if (!enabled) return;
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  thud(c, t, 1.2, 40);
  thud(c, t + 0.15, 1.0, 32);
  thud(c, t + 0.3, 0.7, 28);
  const o = c.createOscillator(); const g = c.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(60, t);
  o.frequency.exponentialRampToValueAtTime(35, t + 1.0);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + 1.3);
}
export function playUi() {
  if (!enabled) return; const c = ac(); if (!c) return;
  const t = c.currentTime; const o = c.createOscillator(); const g = c.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.1);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.14);
}