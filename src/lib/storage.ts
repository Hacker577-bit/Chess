export type Stats = {
  rating: number;
  games: number;
  results: number[];            // 1 win, 0.5 draw, 0 loss (recent)
  weaknesses: Record<string, number>; // 0..100 mastery per category
};

const KEY = 'chess.stats.v1';
const DEFAULT: Stats = {
  rating: 1200, games: 0, results: [],
  weaknesses: { opening: 30, tactics: 30, endgame: 30, kingSafety: 30, blunders: 30 }
};

export function loadStats(): Stats {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s ? { ...DEFAULT, ...s } : { ...DEFAULT }; }
  catch { return { ...DEFAULT }; }
}
export function saveStats(s: Stats) { localStorage.setItem(KEY, JSON.stringify(s)); }

// Elo update with K-factor; confidence from recent variance.
export function recordGame(prev: Stats, result: number, opponent: number): Stats {
  const expected = 1 / (1 + Math.pow(10, (opponent - prev.rating) / 400));
  const K = prev.games < 20 ? 40 : 24;
  const rating = Math.round(prev.rating + K * (result - expected));
  const results = [...prev.results, result].slice(-30);
  return { ...prev, rating, games: prev.games + 1, results };
}

// Confidence: more games + lower variance of recent results → higher confidence.
export function ratingConfidence(s: Stats): { margin: number; confidence: number } {
  if (s.results.length < 3) return { margin: 220, confidence: 18 };
  const n = s.results.length;
  const mean = s.results.reduce((a, b) => a + b, 0) / n;
  const variance = s.results.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const stability = 1 - Math.min(1, variance / 0.3);          // 0..1
  const volume = Math.min(1, n / 25);                          // 0..1
  const confidence = Math.round((0.5 * stability + 0.5 * volume) * 100);
  const margin = Math.round(260 * (1 - confidence / 100) + 40);
  return { margin, confidence };
}

export function bumpWeakness(prev: Stats, category: string, delta: number): Stats {
  const cur = prev.weaknesses[category] ?? 30;
  const next = Math.max(0, Math.min(100, Math.round(cur + delta)));
  return { ...prev, weaknesses: { ...prev.weaknesses, [category]: next } };
}

export type Theme = 'classic' | 'colorblind' | 'minimal';
const TKEY = 'chess.theme.v1';
export function loadTheme(): Theme { return (localStorage.getItem(TKEY) as Theme) || 'classic'; }
export function saveTheme(t: Theme) { localStorage.setItem(TKEY, t); document.documentElement.setAttribute('data-theme', t); }