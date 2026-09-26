# Project Rules

2D god-sim / civilization sim. Full design lives in `DESIGN.md`. Implement one phase at a time.

## Environment
- The developer works **only from an Android phone** (Claude Code + GitHub). There's no desktop.
- Everything must be testable in a phone browser via **GitHub Pages**. No build step or local tooling can be required to run the game.
- Portrait orientation, touch-first controls (tap, drag, pinch). Must run smoothly on a mid-range Android browser.

## Stack (fixed)
- Phaser 3 from CDN, vanilla JS ES modules, no bundler/build step.
- localStorage for saves. Capacitor (APK) comes later, not now.
- Use relative paths only (the Pages site is served from a subpath).

## Architecture
- `/src/sim/`: pure JS game logic. **No Phaser imports, no DOM, no `Math.random()`.**
- `/src/render/`, `/src/scenes/`: Phaser code that reads sim state and draws it. Rendering never mutates sim state; the player acts only through god-power commands.
- Fixed sim tick (default 4/sec), with speed controls: pause, 1x, 2x, 4x.
- All sim randomness goes through the seeded RNG (`src/sim/rng.js`, mulberry32). The RNG state is part of the saved state.
- Content (skills, techs, buildings, items, traits, resources) goes in `/data/*.json`. New content should mean editing JSON, not code.
- Sim state must be plain JSON-serializable data: no class instances, functions, Maps/Sets, or circular refs. Reference entities by id.
- Every notable event goes to the history log with the in-game date ("Year 3, Spring: ...").

## Conventions
- Keep files small and focused. Comment only the non-obvious logic.
- camelCase for JS, lowercase ids in JSON (`"stone_tools"`).
- Test by loading the GitHub Pages URL on the phone before calling a feature done.
