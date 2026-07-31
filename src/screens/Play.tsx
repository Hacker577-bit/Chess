import { useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import ChessBoard from '../components/ChessBoard';
import type { Arrow, BoardHandle } from '../components/ChessBoard';
import MasteryRing from '../components/MasteryRing';
import { analyzePlayedMove, classifyWeakness } from '../lib/evaluation';
import type { Analysis } from '../lib/evaluation';
import { chooseMove, LEVELS, levelConfig } from '../lib/bot';
import type { Level } from '../lib/bot';
import { playCheckmate } from '../lib/sound';
import { loadStats, recordGame, bumpWeakness, saveStats, ratingConfidence } from '../lib/storage';
import type { Stats } from '../lib/storage';

type Mode = 'ai' | 'local';
type HistoryEntry = { san: string; cls: Analysis['classification']; fenBefore: string; played: Move; better?: Move };

/** Depth used to grade YOUR moves — independent of the opponent's difficulty. */
const ANALYSIS_DEPTH = 2;

const PIECE_UNICODE: Record<string, Record<string, string>> = {
  w: { k: '\u2654', q: '\u2655', r: '\u2656', b: '\u2657', n: '\u2658', p: '\u2659' },
  b: { k: '\u265A', q: '\u265B', r: '\u265C', b: '\u265D', n: '\u265E', p: '\u265F' },
};
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function CapturedTray({ pieces, color, label }: { pieces: string[]; color: 'w' | 'b'; label: string }) {
  const counts = new Map<string, number>();
  for (const p of pieces) counts.set(p, (counts.get(p) || 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => VALUE[b[0]] - VALUE[a[0]]);
  return (
    <div className="capture-tray">
      <span className="label">{label}</span>
      {sorted.length === 0 && <span className="muted" style={{ fontSize: 12 }}>None</span>}
      {sorted.map(([type, count]) => (
        <span key={type} style={{ display: 'inline-flex', alignItems: 'center' }}>
          <span className={`piece-icon ${color}`}>{PIECE_UNICODE[color][type]}</span>
          {count > 1 && <span className="count">x{count}</span>}
        </span>
      ))}
    </div>
  );
}

export default function Play() {
  const chess = useMemo(() => new Chess(), []);
  const [, force] = useState(0);
  const [mode, setMode] = useState<Mode>('ai');
  const [playerColor] = useState<'w' | 'b'>('w');
  const [level, setLevel] = useState<Level>('amateur');
  const [last, setLast] = useState<{ from: any; to: any } | null>(null);
  const [anno, setAnno] = useState<{ square: any; text: string; key: number } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [stats, setStats] = useState<Stats>(() => loadStats());
  const [replay, setReplay] = useState<{ chess: Chess; arrow: Arrow } | null>(null);
  const [status, setStatus] = useState('Your move');
  const [gameResult, setGameResult] = useState<string | null>(null);
  const analyzing = useRef(false);
  const boardRef = useRef<BoardHandle>(null);
  // the FEN *before* each move, so a move can be graded against its own position
  const prevFenRef = useRef(new Chess().fen());
  const scored = useRef(false);

  const conf = ratingConfidence(stats);

  function refresh() { force(n => n + 1); }

  function describeEnd() {
    if (chess.isCheckmate()) {
      // after mate, chess.turn() is the side that has been mated
      const loser = chess.turn();
      if (mode === 'local') return `Checkmate — ${loser === 'w' ? 'Black' : 'White'} wins`;
      return loser === playerColor ? 'Checkmate — you lose' : 'You win! 🏆';
    }
    if (chess.isStalemate()) return 'Draw — stalemate';
    if (chess.isInsufficientMaterial()) return 'Draw — insufficient material';
    if (chess.isThreefoldRepetition()) return 'Draw — threefold repetition';
    if (chess.isDraw()) return 'Draw — 50-move rule';
    return 'Draw';
  }

  function endGameIfNeeded() {
    if (!chess.isGameOver() || scored.current) return;
    scored.current = true;
    const resultText = describeEnd();
    setStatus(resultText);
    if (chess.isCheckmate()) {
      playCheckmate();
      setGameResult(resultText);
    }
    if (mode !== 'ai') return;
    const res = chess.isCheckmate() ? (chess.turn() === playerColor ? 0 : 1) : 0.5;
    const ns = recordGame(stats, res, levelConfig(level).rating);
    setStats(ns); saveStats(ns);
  }

  function onMove(m: Move) {
    setLast({ from: m.from, to: m.to });
    setAnno({ square: m.to, text: shortIdea(m), key: Date.now() });

    const entry: HistoryEntry = { san: m.san, cls: 'best', fenBefore: prevFenRef.current, played: m };
    prevFenRef.current = chess.fen();
    setHistory(h => [...h, entry]);

    // check for mate/stalemate FIRST — otherwise the bot gets scheduled on a
    // finished position and the game never announces a result
    endGameIfNeeded();
    refresh();

    if (!chess.isGameOver() && mode === 'ai' && chess.turn() !== playerColor) {
      setStatus('Thinking…');
      setTimeout(aiMove, 250);
    } else if (!chess.isGameOver()) {
      setStatus(chess.isCheck() ? 'Check!' : 'Your move');
    }

    // background analysis for the player's own moves
    if ((m.color === playerColor) && !analyzing.current) {
      analyzing.current = true;
      setTimeout(() => {
        const a = analyzePlayedMove(entry.fenBefore, m, ANALYSIS_DEPTH);
        setHistory(h => h.map((e, idx) => idx === h.length - 1 ? { ...e, cls: a.classification, better: a.bestMove } : e));
        if (a.classification === 'blunder' || a.classification === 'mistake') {
          const w = classifyWeakness(chess, a);
          if (w) { const ns = bumpWeakness(stats, w, a.classification === 'blunder' ? -6 : -3); setStats(ns); saveStats(ns); }
        } else if (a.classification === 'best') {
          const ns = bumpWeakness(stats, 'tactics', 1); setStats(ns); saveStats(ns);
        }
        analyzing.current = false;
        refresh();
      }, 50);
    }
  }

  function shortIdea(m: Move) {
    if (m.captured) return 'Capture!';
    if (m.san.includes('+')) return 'Check!';
    if (m.san === 'O-O' || m.san === 'O-O-O') return 'Castle';
    if (m.promotion) return 'Promote!';

    const piece = m.piece;
    const fromRank = m.from[1];

    if (['n', 'b'].includes(piece) && (fromRank === '1' || fromRank === '8')) return 'Develop';

    if (piece === 'p') {
      if (['d4','e4','d5','e5'].includes(m.to)) return 'Center';
      return 'Pawn push';
    }

    if (piece === 'k') return 'King move';
    if (piece === 'n') return 'Knight hop';
    if (piece === 'b') return 'Bishop move';
    if (piece === 'r') return 'Rook move';
    if (piece === 'q') return 'Queen move';

    return 'Reposition';
  }

  function aiMove() {
    if (chess.isGameOver()) return;
    const choice = chooseMove(chess, level);
    if (!choice) return;
    // Route through the board so the bot's piece slides + thuds like a human move.
    // The board applies it to `chess` and calls onMove itself.
    boardRef.current?.applyMove(choice.from, choice.to, choice.promotion);
  }

  function newGame() {
    chess.reset(); setHistory([]); setLast(null); setAnno(null); setReplay(null); setGameResult(null);
    prevFenRef.current = new Chess().fen();
    scored.current = false;
    setStatus('Your move'); refresh();
  }

  function replayBlunder(idx: number) {
    const e = history[idx]; if (!e?.better) return;
    const c = new Chess(e.fenBefore);
    setReplay({ chess: c, arrow: { from: e.better.from as any, to: e.better.to as any, color: '#46c08a' } });
    setStatus(`Better was ${e.better.san}`);
  }

  const interactive = mode === 'local' ? true : (chess.turn() === playerColor && !chess.isGameOver());
  const rows = Math.ceil(history.length / 2);

  return (
    <div className="screen grid cols-2" style={{ alignItems: 'start' }}>
      <div className="grid" style={{ gap: 14 }}>
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row">
              <button className={`btn ${mode==='ai'?'primary':''}`} onClick={() => { setMode('ai'); newGame(); }}>vs Computer</button>
              <button className={`btn ${mode==='local'?'primary':''}`} onClick={() => { setMode('local'); newGame(); }}>Local 2P</button>
            </div>
            <button className="btn" onClick={newGame}>↻ New</button>
          </div>

          {mode === 'ai' && (
            <div style={{ marginTop: 12 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Difficulty</div>
              <div className="row">
                {LEVELS.map(l => (
                  <button
                    key={l.id}
                    className={`btn ${level === l.id ? 'primary' : ''}`}
                    style={{ fontSize: 13, padding: '8px 12px' }}
                    onClick={() => { setLevel(l.id); newGame(); }}
                    title={`Plays around ${l.rating} rating`}
                  >
                    {l.label}
                    <span style={{ opacity: .65, fontSize: 11, marginLeft: 6 }}>{l.rating}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="muted" style={{ margin: '10px 0 0' }}>{status}</p>
        </div>

        {replay ? (
          <div className="card grid" style={{ gap: 10 }}>
            <h2>🔁 Blunder Replay</h2>
            <ChessBoard chess={replay.chess} interactive={false} arrows={[replay.arrow]} slowMo />
            <button className="btn" onClick={() => setReplay(null)}>Close</button>
          </div>
        ) : (
          <>
            <CapturedTray
              pieces={history.filter(h => h.played.color === 'b' && h.played.captured).map(h => h.played.captured!)}
              color="w" label="Captured by you:"
            />
            <ChessBoard ref={boardRef} chess={chess} orientation={playerColor} interactive={interactive}
                        onMove={onMove} highlightLast={last} annotation={anno} />
            <CapturedTray
              pieces={history.filter(h => h.played.color === 'w' && h.played.captured).map(h => h.played.captured!)}
              color="b" label="Captured by opponent:"
            />
          </>
        )}

        {gameResult && (() => {
          const isWin = gameResult.includes('win') || (gameResult.includes('Checkmate') && !gameResult.includes('you lose'));
          const isLose = gameResult.includes('lose') || (gameResult.includes('Checkmate') && gameResult.includes('you lose'));
          const cls = isWin ? 'win' : isLose ? 'lose' : 'draw';
          const symbol = isWin ? '\u265A' : isLose ? '\u2716' : '\u265B';
          return (
            <div className="checkmate-overlay">
              <div className={`mate-symbol ${cls}`}>{symbol}</div>
              <h2 style={{ color: isWin ? 'var(--accent-2)' : isLose ? 'var(--bad)' : 'var(--muted)' }}>
                {gameResult.replace(/ 🏆$/, '')}
              </h2>
              <div className="mate-detail">
                {isWin ? 'Perfect game! Your strategy paid off.' :
                 isLose ? 'Review the game to learn from mistakes.' :
                 'A hard-fought battle.'}
              </div>
              <button className="btn primary" onClick={newGame}>Play Again</button>
            </div>
          );
        })()}
      </div>

      <div className="grid" style={{ gap: 14 }}>
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{stats.rating}</div>
              <div className="muted" style={{ fontSize: 12 }}>Rating · {stats.games} games</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="pill">{conf.confidence}% confidence</div>
              <div className="muted" style={{ fontSize: 12 }}>±{conf.margin} pts</div>
            </div>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: 'var(--panel-2)', marginTop: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${conf.confidence}%`, background: 'linear-gradient(90deg,var(--accent),var(--accent-2))', transition: 'width .6s' }} />
          </div>
        </div>

        <div className="card">
          <h2>Weakness Tracker</h2>
          <div className="row" style={{ justifyContent: 'space-around' }}>
            {Object.entries(stats.weaknesses).map(([k, v]) => <MasteryRing key={k} value={v} label={k} />)}
          </div>
        </div>

        <div className="card">
          <h2>Moves</h2>
          <div className="history">
            {Array.from({ length: rows }, (_, i) => (
              <FragmentRow
                key={i}
                n={i + 1}
                white={history[i * 2]}
                black={history[i * 2 + 1]}
                whiteIdx={i * 2}
                blackIdx={i * 2 + 1}
                onBlunder={replayBlunder}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** One numbered row holding White's and Black's move for that turn. */
function FragmentRow({ n, white, black, whiteIdx, blackIdx, onBlunder }: any) {
  return (<>
    <span className="n">{n}.</span>
    <span className={`mv ${white?.cls === 'blunder' ? 'blunder' : ''}`}
          onClick={() => white?.cls === 'blunder' && onBlunder(whiteIdx)}
          title={white?.cls}>{white?.san ?? ''}</span>
    <span className={`mv ${black?.cls === 'blunder' ? 'blunder' : ''}`}
          onClick={() => black?.cls === 'blunder' && onBlunder(blackIdx)}
          title={black?.cls}>{black?.san ?? ''}</span>
  </>);
}
