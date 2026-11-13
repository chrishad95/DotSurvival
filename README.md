# Dot Survival

A lightweight, single-player, browser-based arcade game in the style of Agar.io. You control a cell, eat colorful pellets to grow, hunt smaller computer-controlled cells, and run from bigger ones.

**Move → Eat → Grow → Hunt → Survive → Repeat.**

Built with vanilla TypeScript, HTML5 Canvas 2D and Vite. There is no backend, account, or runtime dependency; the production build is about 22 kB of JavaScript.

## How to play

- **Desktop:** move the mouse. The cell steers toward the pointer and slows to a stop when the pointer is on top of it.
- **Mobile / tablet:** touch and drag with one finger. Lift the finger to stop.
- Eat pellets to gain mass. Eat a cell that is at least 20% larger in radius than the cell you are eating (and mostly overlap it) to take 85% of its mass.
- If a cell 20% bigger than you overlaps you, it eats you. The game-over card shows your stats and a **Restart** button (or press Enter / Space).
- Bigger cells are slower, and the camera zooms out as you grow. Your best score is saved in `localStorage`.

## Requirements

- [Node.js](https://nodejs.org/) 20.19+ or 22.12+ (developed on Node 24 LTS) and npm.

## Setup and local development

```bash
npm install
npm run dev        # http://127.0.0.1:5173
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server with hot reload (bound to 127.0.0.1) |
| `npm run build` | Type-check, then build to `dist/` |
| `npm run preview` | Serve the production build locally (http://127.0.0.1:4173) |
| `npm run typecheck` | TypeScript strict type-check only |
| `npm test` | Unit and headless-simulation tests (Vitest) |
| `npm run test:e2e` | Real-browser end-to-end test of the production build (see below) |

### Tests

- `npm test` covers growth/speed formulas, arena clamping, frame-rate independence, circle collision and the size-advantage rule, the spatial grid, camera maths, pellet and opponent replacement, player death and restart, and the AI (fleeing, hunting, food collection) by simulating the game headlessly.
- `npm run test:e2e` serves `dist/` from the sub-path `/apps/dot-survival/` (to prove subdirectory hosting works), then drives it in Microsoft Edge (or Chrome) with `playwright-core`: mouse and emulated touch control, eating, boundaries, zoom, death, restart, best-score persistence across reload, resize, tab hiding, and a check that the console is free of errors. Run `npm run build` first. Use `E2E_BROWSER_CHANNEL=chrome` to use Chrome instead of Edge. Screenshots are written to `e2e/screenshots/` (git-ignored).

## Production build and deployment

```bash
npm run build
```

The static site is written to `dist/`. `vite.config.ts` sets `base: './'`, so all asset URLs are relative and the site works from the domain root **or any subdirectory** with no configuration changes.

### GitHub Pages (automatic)

`.github/workflows/deploy.yml` builds and deploys on every push to `main`.

1. Push the repository to GitHub.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main`. The game is published at `https://<user>.github.io/<repo>/`.

### Any other static host

Upload the contents of `dist/` to Netlify, Cloudflare Pages, S3, nginx, etc. Serve over HTTPS.

## Project structure

```text
index.html              Canvas + HUD / leaderboard / game-over markup
public/favicon.svg
src/
  main.ts               Entry point
  styles.css
  game/
    GameConfig.ts       ALL tuning values (world size, speeds, AI ranges, zoom, ...)
    GameState.ts        DOM-free simulation: update(), pellets, consumption, respawn
    Game.ts             requestAnimationFrame loop, wiring, resize, visibility, best score
    Cell.ts             Cell data, radius/speed formulas, movement and arena clamping
    Player.ts           Pointer offset -> steering (dead zone / throttle)
    Food.ts             Pellets and evenly-spread initial placement
    OpponentAI.ts       Flee > hunt > collect food, throttled decisions
    Camera.ts           Smooth follow, zoom, world <-> screen conversion
    Collision.ts        Circle overlap, consumption rule, spatial grid
    Input.ts            Mouse / one-finger touch via Pointer Events
    Renderer.ts         Canvas drawing with culling
    game.test.ts        Vitest tests
  ui/                   HUD, Leaderboard, GameOver, best-score storage
e2e/e2e.mjs             Browser end-to-end test
```

## Tuning

Everything is in [`src/game/GameConfig.ts`](src/game/GameConfig.ts): arena size (5000 × 5000), pellet count (1200), opponent tiers (8 small / 8 medium / 4 large), size advantage (1.2), mass transfer (85%), AI danger/hunt/food radii and decision interval (~6 per second), zoom settings (min 0.45), maximum frame delta, and the `localStorage` key.

## Design notes

- **Separation:** `GameState` has no DOM or canvas dependency; `Game` drives it and `Renderer` only reads it.
- **Performance:** pellets live in a spatial hash, so pellet collisions, AI food queries and rendering only look at nearby pellets. The renderer culls off-screen entities and batches pellets by color. Device pixel ratio is capped at 2.
- **Robustness:** frame deltas are clamped (50 ms); the loop pauses while the tab is hidden and resumes without a jump; `localStorage` failures (e.g. private mode) are tolerated.
- **Fairness:** opponents spawn away from the player, replacement pellets avoid cells, and an overlap requirement means edge contact never lets a smaller cell eat a larger one.

## Out of scope for v1.0

Multiplayer, accounts, backend, skins, split/eject mechanics, game modes, and advanced audio are intentionally not included.

## License

MIT
