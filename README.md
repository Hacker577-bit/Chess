# Chess

An offline-first chess app: play against a bot or a friend, walk through
lessons, and drill openings and endgames. Built with React, TypeScript and
Vite, and installable as a PWA.

The board follows the familiar green/cream layout — flat squares, yellow
move highlights, dot hints for legal moves, and click-to-move or drag-to-move
handling.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

```bash
npm run build    # typecheck + production bundle into dist/
npm run preview  # serve the built bundle locally
```

## Features

- **Play** — vs. a built-in bot (shallow minimax over material) or local
  two-player. Every move you make is analysed in the background and
  classified (best / good / inaccuracy / mistake / blunder); blunders are
  flagged in the move list and can be replayed in slow motion with an arrow
  showing the better move.
- **Learn** — guided lessons that step through a position move by move.
- **Practice / Openings / Endgames** — themed positions to work through.
- **Rating & weakness tracking** — a local Elo-style rating with a confidence
  band, plus per-category mastery rings (opening, tactics, endgame, king
  safety, blunders) that shift as you play. Stored in `localStorage`.
- **Offline** — a service worker precaches everything, so it runs with no
  network after the first load.
- **Accessibility** — colourblind and minimalist board themes, and full
  `prefers-reduced-motion` support.

## Project layout

```
src/
  components/   ChessBoard, LessonPlayer, MasteryRing, InstallButton
  screens/      Home, Play, Learn, Practice, Openings, Endgames, Settings
  lib/          attacks, evaluation, sound, storage
  data/         lessons, openings
  assets/       pieces.svg (piece sprite)
```

Rules and move generation come from [chess.js](https://github.com/jhlywa/chess.js).
`ChessBoard` keeps its own list of tracked pieces alongside the engine so that
captures, castling and en-passant animate correctly; the bot plays through the
same `applyMove` path as a human so its moves animate identically.

Sound is synthesised at runtime with the Web Audio API (`src/lib/sound.ts`) —
there are no audio files to ship. Browsers block audio until a user gesture, so
it unlocks on the first pointer press.

## Credits

Chess piece artwork by [Cburnett](https://en.wikipedia.org/wiki/User:Cburnett)
and [Rfc1394](https://en.wikipedia.org/wiki/User:Rfc1394), via Wikimedia
Commons, licensed under
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The sprite is
bundled from [cm-chessboard](https://github.com/shaack/cm-chessboard) (MIT) and
kept at `src/assets/pieces.svg` with its licence header intact.

Because the pieces are share-alike, keep this attribution if you redistribute
the app or modify the artwork.
