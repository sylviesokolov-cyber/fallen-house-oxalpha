# Project Rules

2D god-sim / civilization sim. Full design and phase roadmap live in `DESIGN.md`. Implement one phase at a time.

## Environment
- The developer works **only from an Android phone** (Claude Code + GitHub). There's no desktop.
- Everything must be testable in a phone browser via **GitHub Pages**. Nothing may require a build step or local tooling to run the game.
- Portrait orientation, touch-first controls (tap, drag, pinch). Must run smoothly on a mid-range Android browser.

## Stack (fixed)
- Phaser 3 from CDN (`index.html`), vanilla JS ES modules, no bundler/build step.
- localStorage for saves. Capacitor (APK) comes later, not now.
- Use relative paths only (the Pages site is served from a subpath).

## Layout
- `src/sim/`: pure game logic. **No Phaser, DOM, window, localStorage, or `Math.random()`** (a test enforces this).
- `src/render/`: Phaser drawing and camera. Reads sim state, never mutates it.
- The player changes the sim only through `usePower` in `src/sim/godPowers.js` (called from `WorldScene` when a power is armed and the map is tapped).
- `src/scenes/`: `BootScene` loads `/data` and creates the sim; `WorldScene` runs the clock and drives rendering.
- `src/ui/`: HTML/CSS overlay UI (top bar, panels). Uses DOM because native text, scrolling, and buttons work better on phones.
- `src/runner.js`: fixed-timestep loop (ticks/sec from `data/config.json`; speed 0/1/2/4).
- `data/*.json`: content and tuning. New content or balance changes should mean editing JSON, not code. `data/sanctuary.json` is the map layout (walls, portal, zones, starting buildings, plots, home plots).
- `src/sim/construction.js`: plots, construction sites, upgrades and family homes. Building effects at a level come from `effectsOf`/`buildingEffect` in `buildings.js` (base effects plus upgrades reached).

## Sim rules
- All sim randomness goes through `src/sim/rng.js` (mulberry32). The RNG state lives in the sim state, so a save resumes the same sequence.
- Sim state is plain JSON data: no class instances, functions, Maps/Sets, or circular refs. Entities reference each other by id. Bump `SAVE_VERSION` in `src/sim/save.js` on incompatible changes.
- Every notable event goes to the history log via `logEvent(state, text)`.
- Knowledge is per person (`h.knows`). Anything a tech unlocks (buildings, items, using a shelter) must check that the person knows it. Techs spread only through teaching, and are lost when the last holder dies.
- Keep files small and focused. Comment only the non-obvious logic.

## Testing
- `npm test` (Node's built-in test runner, no dependencies) checks determinism, save/load, survival, and sim purity. Run it before every push.
- For UI changes, load the page in headless Chromium at a phone viewport and check it works. The Phaser CDN may be blocked in the cloud sandbox; if so, serve a copy of `phaser.min.js` from npm through a Playwright route.
- `window.godSim` exposes the app context for debugging.
- Add `?seed=abc` to the URL to replay a specific world.
