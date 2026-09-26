# Game Design Document

## Game Concept

A 2D god-simulation / civilization sim for Android (portrait) and web.

The player is a god watching over a small tribe of ordinary humans. The player **cannot** directly control anyone. Humans are autonomous: they meet their own needs, learn skills by doing, form bonds, teach each other, make discoveries, and slowly build a civilization. The player influences the world indirectly through god powers.

The heart of the game is **emergent stories**: watching individuals grow, bond, discover, and die, recorded in a history log.

Reference feel: WorldBox + RimWorld + Black & White.

## Tech Stack (fixed; do not change)

- Phaser 3 (loaded from CDN), vanilla JavaScript (ES modules), no build step
- localStorage for saves
- Deployed via GitHub Pages for phone-browser testing
- Capacitor later for APK packaging (not now)
- Portrait orientation, touch-first controls (tap, drag, pinch)
- Must run smoothly on a mid-range Android phone browser

## Architecture Rules

1. **Simulation is separate from rendering.**
   - `/src/sim/` holds pure JS game logic. No Phaser imports allowed there.
   - `/src/render/` and `/src/scenes/` hold Phaser code that *reads* sim state and draws it.
   - The sim runs at a fixed tick rate (default 4 ticks/sec) with speed controls (pause, 1x, 2x, 4x).
2. **Seeded random number generator.**
   - All randomness in the sim goes through a seeded RNG (e.g. mulberry32).
   - Never use `Math.random()` in `/src/sim/`.
3. **Data-driven content.**
   - Skills, techs, buildings, items, traits, and resources are defined in JSON files in `/data/`.
   - Adding content should mean editing JSON, not code.
4. **Save/load.**
   - The whole sim state must be serializable to JSON (no functions or class instances that can't be rebuilt).
5. **History log.**
   - Every notable event is pushed to a history log with the in-game date,
     e.g. "Year 3, Spring: Mara discovered Fire", "Year 5: Tomas and Lia became friends".
6. Keep files small and focused. Comment the non-obvious logic.

### Suggested structure

```
/index.html
/src/main.js
/src/scenes/   (BootScene, WorldScene, UIScene)
/src/render/   (map, humans, effects)
/src/sim/      (world.js, human.js, needs.js, ai.js, skills.js, bonds.js, discovery.js,
                godPowers.js, time.js, rng.js, history.js, save.js)
/data/         (traits.json, skills.json, techs.json, buildings.json, items.json, resources.json)
/assets/       (placeholder shapes for now)
```

## Simulation Design (full vision; build in phases)

### World

- Tile grid (start 64x64). Tiles: grass, water, forest, stone, sand, and later fertile soil and ore.
- Resources on tiles: berry bushes, trees (wood), stone, animals, clay near water.
- Resources regrow over time.
- Time: ticks -> days -> seasons -> years. Seasons affect food growth.

### Humans (each is a unique individual)

- Name, age, sex, generated from simple name lists.
- **Needs** (0-100): hunger, energy, safety, social. Unmet needs lower health and mood.
- **Traits** (1-3 each, from `traits.json`): curious, brave, lazy, kind, clever, aggressive, patient, etc.
  Traits modify decision weights and learning speed.
- **Skills** (from `skills.json`), each with a level and XP:
  Foraging, Hunting, Woodcutting, Crafting, Building, Cooking, Farming, Healing, Teaching, Research, and so on.
  Skills are **learned by doing**: performing an action gives XP in the related skill. Nobody starts as a specialist.
- **Knowledge**: a set of known techs. A human can only use a tech/building/item they know.
- **Mood**: derived from needs, bonds, and events.
- **Life cycle**: children -> adults -> elders -> death (old age, starvation, injury, disease).
  Couples with strong bonds can have children. Children inherit some traits.
- Knowledge that nobody else knows is **lost** when its holder dies (important for drama).

### AI / Decision Making

- Utility AI: each tick, an idle human scores possible actions (eat, sleep, gather, socialize, build, research, teach, explore, flee)
  based on needs, traits, skills, and known techs, then picks the best (with a little randomness).
- Actions take multiple ticks: move to target, perform, finish.
- Simple pathfinding on the tile grid (A* or BFS; keep it cheap).

### Bonds / Relationships

- Each pair of humans has a relationship value (-100 to 100) and a type: stranger, acquaintance, friend, close friend, rival, partner, family.
- Relationships change from spending time together, shared work, helping each other, conflicts, and trait compatibility.
- **Teaching**: bonded humans can teach known techs and skill XP to each other.
  Better bonds + Teaching skill = faster transfer. This is how knowledge spreads.
- Notable relationship changes go to the history log.

### Discovery & Research

- Techs in `techs.json` have: id, name, era, prerequisites, discovery conditions, and what they unlock (buildings, items, actions).
- Early techs are discovered by **chance** when conditions are met, e.g.:
  - **Fire**: human is curious, near a lightning-struck tree or dry forest, has high Woodcutting.
  - **Stone Tools**: repeated gathering of stone, Crafting >= 2.
  - **Shelter**: tribe experienced cold/rain, Building or Woodcutting >= 3.
  - **Pottery**: knows Fire, has handled clay many times.
  - **Farming**: repeated foraging of berries near fertile soil, patient or clever trait.
- Chance increases with the curious/clever traits, relevant skill levels, and god inspiration.
- Later (after Writing + a building like a hut of learning), deliberate **research** becomes possible: humans with high Research skill spend time studying and generate research points toward chosen techs.
- Eras: Primitive -> Tribal -> Village -> Early Civilization (expand later).

Example tech JSON:

```json
{
  "id": "fire",
  "name": "Fire",
  "era": "primitive",
  "prerequisites": [],
  "discovery": {
    "type": "chance",
    "baseChance": 0.0005,
    "conditions": [
      { "type": "nearTileFeature", "feature": "burningTree", "radius": 3 },
      { "type": "skillMin", "skill": "woodcutting", "level": 1 }
    ],
    "traitBonus": { "curious": 2.0, "clever": 1.5 }
  },
  "unlocks": { "buildings": ["campfire"], "actions": ["cook"] }
}
```

### Buildings & Items

- Buildings (`buildings.json`): campfire, lean-to, hut, storage pit, shrine, farm plot, workshop, and more later.
  They need known tech + resources + Building skill. Humans decide by themselves when to build.
- Items (`items.json`): stone axe, spear, basket, pottery, cooked food, etc. They boost actions.

### God Powers (player's only way to act)

- Powers cost **faith**. Faith is generated when humans worship (mainly at a Shrine, and after witnessing miracles).
- Starting powers: **Rain** (grows plants, puts out fire), **Lightning** (can start fires; dangerous),
  **Spawn Food** (berries/animals), **Bless** (temporary boost to one human's mood and learning),
  **Inspire** (a dream that raises one human's discovery chance for a while).
- Later: Drought, Flood, Plague, Heal, Fertility, Omen (changes the tribe's beliefs).
- The player selects a power from a bottom toolbar and taps a tile or human.

## UI (portrait, touch)

- Main view: map with drag-to-pan and pinch-to-zoom.
- Top bar: date, speed controls, Faith, population.
- Bottom toolbar: god powers.
- Tap a human -> inspect panel: name, age, traits, needs bars, skills, known techs, top relationships, current action.
- History log panel (scrollable).
- Tech panel showing what the tribe knows (discovered only; unknown techs hidden as "???").

## Phase Roadmap

1. **World + wandering humans + basic needs** — done
2. **Actions and resources (gather, eat, sleep, regrowth, death by starvation)** — done
3. **Traits, skills learned by doing, inspect panel details** — done
4. **Relationships, socializing, teaching, families, births** — done
5. **Discovery system + first 10 techs + first buildings and items** — done
6. God powers + Faith + Shrine and worship
7. Research, eras, villages, multiple tribes, trade/conflict
8. Polish, art, sound, save slots, Capacitor APK

### Phase 1 scope

1. Project structure, `index.html` loading Phaser 3 from CDN, ES modules.
2. Seeded RNG in `/src/sim/rng.js`.
3. 64x64 tile world with grass, water, forest, and stone from simple noise; berry bushes on grass. Colored rectangles as placeholder art.
4. Camera: drag to pan, pinch to zoom, clamped to world bounds. Works with touch and mouse.
5. 10 humans with names, ages, and hunger and energy needs that slowly decrease.
6. Behavior: wander randomly; when hungry, walk to the nearest berry bush and eat; when tired, sleep in place.
7. Fixed-tick sim loop (4 ticks/sec) separate from rendering; humans move smoothly between tiles.
8. Top bar with in-game day counter and pause / 1x / 2x / 4x buttons.
9. Tap a human to open an inspect panel (name, age, needs, current action).
10. History log: "Day X: [Name] was born into the world" at start, plus starvation deaths.
11. Save and load to localStorage (top bar buttons).
12. GitHub Pages deployment.
