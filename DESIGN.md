# Game Design Document

> **Direction change (Sept 2026).** The game started as an open-world
> civilization sim (phases 1–6.5, see git history before this file changed).
> It is now a **walled sanctuary** game in the spirit of *Pick Me Up,
> Infinite Gacha*: a small, closed home where every person is a hero whose
> life you follow closely, who grow by training, building and venturing
> through a portal into dangerous dungeons. Most systems built so far carry
> over (see "What carries over").

## Game Concept

A 2D life-and-growth sim for Android (portrait) and web.

A small community lives inside an **enclosed, walled sanctuary**. They are autonomous: they eat, sleep, train, work, fall in love, raise children, discover new knowledge and slowly build their home up, building by building. For anything the sanctuary can't provide (meat, spices, ore, magic crystals) they must step through a **portal** into dungeons full of monsters, where death is real.

The pace is **slow on purpose**: few people, long lives, so that **every life feels significant**. Each person has a grade, stats, a level, skills, traits, emotions, relationships and a history. Births and deaths are major events.

Reference feel: *Pick Me Up, Infinite Gacha* (heroes with grades, stats, levels, dungeon floors), RimWorld (autonomous colonists with needs and moods), Stardew Valley (a small home that grows).

## Tech Stack (fixed; do not change)

- Phaser 3 (loaded from CDN), vanilla JavaScript (ES modules), no build step
- localStorage for saves
- Deployed via GitHub Pages for phone-browser testing
- Capacitor later for APK packaging (not now)
- Portrait orientation, touch-first controls (tap, drag, pinch)
- Must run smoothly on a mid-range Android phone browser

## Architecture Rules

1. **Simulation is separate from rendering.** `/src/sim/` is pure JS (no Phaser, DOM or `Math.random()`); `/src/render/`, `/src/scenes/` and `/src/ui/` read sim state and draw it. Fixed tick rate (4 ticks/sec) with pause/1x/2x/4x.
2. **Seeded RNG** for all sim randomness.
3. **Data-driven content** in `/data/*.json`: adding a building, recipe, monster or tech should mean editing JSON, not code.
4. **Save/load:** the whole sim state is plain JSON.
5. **History log:** every notable event is recorded with its in-game date.
6. Keep files small and focused. Comment the non-obvious logic.

## The Sanctuary (the world)

A small enclosed map (roughly 40×40 tiles) surrounded by a **wall**. Nobody can leave except through the portal.

Zones:
- **Core:** the starting buildings, and empty **building plots** where new buildings go.
- **Tree grove:** a small wood of trees that regrow. The only source of wood.
- **Farm field:** grows **potatoes only**, in every season but winter.
- **Portal:** a gate at the edge of the sanctuary that leads to the dungeons.

There is no stone, clay or ore inside the walls. Everything beyond wood and potatoes comes from the portal.

**Inside the walls people heal on their own**, slowly and fully, from any wound. Only three things kill inside: old age, starvation, and a blow big enough to kill in one hit (which can only happen in the dungeon, so in practice: old age and starvation).

## Starting State

A handful of adults (default 8) and these buildings, all already built:

| Building | Purpose |
|---|---|
| **Great Hall** | One large room where everyone sleeps. |
| **Kitchen** | Where food is cooked. |
| **Dining Hall** | Where people eat together (eating together is social and lifts mood). |
| **Training Ground** | Where people train, raising stats and combat skills. |

**Starting knowledge** (everyone knows these): potato farming, woodcutting, simple cooking (boiled potatoes), basic construction, basic fighting. Everything else must be discovered.

## People (heroes)

Kept from the current build, and deepened:

- **Grade** ★1 Common to ★5 Legendary: potential. Higher grades start stronger and grow faster. Children take after their parents.
- **Stats:** STR, AGI, INT, VIT, CHA. They grow on level-up, toward what the person actually does.
- **Level:** all XP from work, training and combat counts toward it.
- **Skills**, learned by doing: farming, woodcutting, cooking, building, carpentry, smithing, crafting, teaching, research, and the **combat skills** (swordsmanship, archery, defense, magic).
- **Traits**, **emotions** and **thoughts**; **relationships** (friends, rivals, partners, family); **teaching**.
- **HP** (health) matters now: combat damages it; inside the walls it slowly returns.
- **Life cycle:** child → adult → elder → death by old age. **Births:** a man and a woman who become partners can conceive; pregnancy lasts a while; the child is born inside the sanctuary and grows up there.
- Each person keeps a **personal history** (key events: born, first discovery, first dungeon, kills, injuries, children, deaths of loved ones) shown on their character sheet.

## Knowledge and Discovery

People start with the basics above. Everything else is **discovered**, the way it works now: people who do things and are near the right things may discover something new. Traits (curious, clever), INT and the Inspire power help. Knowledge spreads by teaching and is **lost** if the last person who knows it dies.

Discoveries now unlock **buildings, building upgrades, recipes, gear and magic**, for example:
- **Carpentry:** a Carpentry Workshop; wooden tools, furniture, bows.
- **Smithing:** needs ore from the portal; a Blacksmith; metal tools, weapons, armour.
- **Recipes:** found by cooks experimenting with ingredients (potato only at first; meat, herbs and spices from the dungeon open many more).
- **Herbalism / medicine:** faster healing, remedies for dungeon injuries.
- **Writing:** a Library; deliberate research.
- **Magic:** needs mana crystals from the portal; a Mage Tower; spells for combat and daily life.

## Building and Upgrading

- New buildings go on the **fixed building plots**.
- **The people decide for themselves** what to build, when someone knows how and the materials exist (as now). The player can steer this with an Omen.
- Buildings have **levels**. Upgrading needs materials and sometimes a discovery, and unlocks more (e.g. Kitchen Lv2: new recipes; Training Ground Lv2: faster training; Great Hall → private family houses).

Planned buildings (JSON, extendable): Carpentry Workshop, Storehouse, Blacksmith, Infirmary, Library, Family Houses, Mage Tower, Tavern.

## Food

- **Potatoes** from the field: eaten raw (poor), or cooked in the Kitchen and eaten in the Dining Hall.
- **Recipes** turn ingredients into meals. Better meals fill more and lift mood (thoughts like "+8 Ate a hearty stew").
- **Dungeon ingredients** (meat, herbs, spices, eggs…) unlock most recipes.
- Food is stored in the Kitchen / a Storehouse and spoils slowly.

## The Portal and Dungeons

The portal leads to **dungeon floors** of rising difficulty.

- A **party** (1–5 heroes) goes in, clears rooms of **monsters**, and comes back with **loot**: meat, ingredients, ore, monster parts, mana crystals, rare items.
- **Combat** uses stats, combat skills, weapons and armour: STR/AGI for attacks, VIT for HP and defence, INT for magic. Each fight grows the fighters' combat skills and levels.
- **Danger is real.** HP does not recover inside the dungeon. A hero at 0 HP is **dead**, unless someone carries them out in time. A strong enough blow kills in one hit. Parties can retreat.
- Fights are shown as a **battle report**: a turn-by-turn log the player can open, in the style of the manhwa.
- Each floor has a **boss**; clearing it opens the next floor and is a history event.

## The Player's Role

To be decided (see open questions). Current assumption: the player is an unseen **patron god**, as now:
- **Faith** from worship and witnessed miracles.
- Powers that fit a closed sanctuary: **Bless** (heal and inspire growth), **Inspire** (discovery), **Omen** (set the community's focus). Rain, Lightning and Food spawning are removed or reworked.
- Possibly: choosing who goes through the portal (open question).

## What Carries Over From the Current Build

Kept: people and needs, AI, grades/stats/levels, skills, traits, emotions and thoughts, relationships and teaching, families and births, old age, per-person knowledge, discovery and teaching of techs, history log, character sheet, Tribe tab, save/load, god powers (reworked).

Replaced: the open noise-generated world, berry bushes, stone and clay deposits, lightning-started fire, the camp → kingdom settlement tiers, campfire/lean-to/hut/storage-pit/farm-plot buildings placed anywhere, and the planned colonies.

## Roadmap

A. **The Sanctuary.** The walled map with zones and plots, the four starting buildings, potatoes and trees, eating in the Dining Hall, sleeping in the Great Hall, training at the Training Ground, auto-healing inside the walls, starting knowledge. Old world systems removed.
B. **Building and upgrading.** Plots, building levels, the people deciding what to build; a new discovery tree for the sanctuary (carpentry, writing, recipes…); recipes from potatoes.
C. **The Portal.** Parties, dungeon floors, monsters, combat and battle reports, loot, injuries and death, bosses.
D. **Depth from the dungeon.** Smithing and gear, recipes with dungeon ingredients, herbalism, magic and the Mage Tower, family houses.
E. **Polish.** Art, sound, save slots, Capacitor APK.

## Open Questions

1. **Who goes through the portal?** The player picks the party and floor (recommended, the most Pick Me Up–like), or the people volunteer on their own (brave, strong, bored).
2. **The player's role:** stay an unseen god with Faith and powers, or become the sanctuary's master who gives orders (build here, train this person)?
3. **Starting size:** 8 adults? Where do they come from (always there, or summoned into the sanctuary)?
4. **Pace:** each year is 30 minutes of real time at 1x now. Slower still, or keep it?
