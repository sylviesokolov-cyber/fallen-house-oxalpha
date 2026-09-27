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
- The player changes the sim only through `usePower` in `src/sim/godPowers.js` (called from `WorldScene` when a power is armed and the map is tapped, and from the Omen and Portal panels).
- `src/scenes/`: `BootScene` loads `/data` and creates the sim; `WorldScene` runs the clock and drives rendering.
- `src/ui/`: HTML/CSS overlay UI (top bar, panels). Uses DOM because native text, scrolling, and buttons work better on phones.
- `src/runner.js`: fixed-timestep loop (ticks/sec from `data/config.json`; speed 0/1/2/4).
- `data/*.json`: content and tuning. New content or balance changes should mean editing JSON, not code. `data/sanctuary.json` is the map layout (walls, portal, zones, starting buildings, plots, home plots).
- `src/sim/dungeon.js` (expeditions: calling, rooms, retreat, death, loot) and `src/sim/combat.js` (turn-based fights and battle report lines). Monsters and floors are in `data/monsters.json` and `data/dungeon.json`. People in the dungeon have `h.away` set: skip them in anything that assumes a person is on the map.
- `logEvent` also files each entry into the life story (`h.story`) of every living person it names, so write log lines with people's names in them.
- `src/render/appearance.js` (pure) decides how a person looks (skin, hair style, beard, build, house sash colour, carried weapon); the map sprite (`humanView.js`) and the SVG portrait (`src/ui/portrait.js`, with crown/tiara marks) both use it. `roofView.js` draws roofs that fade out as the camera zooms in (roof colours are `roof` in `data/buildings.json`). `ambientView.js` draws day/night, season tints and the portal swirl (cosmetic only).
- `src/ui/sound.js` (WebAudio effects and music, no audio files), `src/ui/saves.js` + `menuPanel.js` (save slots, autosave, new world). `manifest.json`, `icons/` and `sw.js` make the game an installable PWA; `sw.js` is network-first, so Pages updates show up right away.
- UI building blocks: `src/ui/icons.js` (the SVG icon set; use `icon(name)` or `<i data-icon="name">`, never platform emoji), `topBar.js`, `sheets.js` (open/close/swipe, `haptic`), `titleScreen.js`, `portrait.js`. Panels rebuild only when their keyed content changes, so taps aren't lost.
- World rendering: `mapRenderer.js` bakes the map at 2x (normal and winter variants), `textures.js` bakes trees, crops, particles and loads the icons for Phaser, `fxView.js` (particles, clouds), `bubbleView.js` (activity icons, floating text). All cosmetic randomness there may use `Math.random`.
- People and the throne: `src/sim/appeal.js` (looks, what people are drawn to, `appeal`), `src/sim/dynasty.js` (houses, wives via `partnerId` + `consorts`, widowing, succession, `seat`/`crown`), `src/sim/decrees.js` (what a puppet ruler can be made to do). A consort's `partnerId` is the ruler; use `isSpouse`/`spousesOf`, not `a.partnerId === b.id` alone. Only men rule and only a man and a woman may wed. A daughter inherits as heiress (`dynasty.heiressId`): she holds the throne until she weds, then her husband is King, and `royalLine` (her) decides who is next.
- Item, tech and building pictures: `src/ui/itemArt.js` draws the glyph named by each entry's `art` in the data (`"glyph"` or `"glyph:#color"`).
- `src/sim/data.js` `DATA_FILES` lists every content file; add new ones there.
- Battle viewer: `combat.js` `fight` also records one event `[actor, target, kind, amount]` per report line, and each report stores the `cast`. `src/ui/battleViewer.js` replays them; monsters are drawn by `src/ui/monsterArt.js` from each monster's `look` in `data/monsters.json`.
- `src/sim/goals.js` (milestones from `data/goals.json`, `goalProgress` for the UI) and `src/sim/events.js` (raids, festivals, sickness `h.sick`, strangers from `data/events.json`). Raids are stored in `state.expeditions` with `raid: true`.
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
