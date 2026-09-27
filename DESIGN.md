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

Built so far (all in `data/buildings.json`):

| Building | Needs | Does |
|---|---|---|
| Carpentry Workshop | Carpentry | Wooden swords (faster training), hoes (faster farming), baskets (carry more) |
| Family House (home plot) | Carpentry | 4 beds for a couple and their children |
| Storehouse | Food Preservation | Food spoils far more slowly |
| Library | Writing | Study: Research XP and much better odds of a discovery |
| Tavern | Brewing | Potato ale: social need, mood, bonds |
| Shrine | Worship | Prayer gives 3× Faith |

Upgrades: Great Hall Lv2 (Architecture, 18 beds, only when nearly full), Kitchen Lv2 (Potato Cuisine, bread), Dining Hall Lv2 (Architecture, meals lift mood more), Training Ground Lv2/Lv3 (Martial Drills, more XP per session).

Still planned: Blacksmith, Infirmary, Mage Tower (need the portal).

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

A. **The Sanctuary** — done. The walled map with zones and plots, the four starting buildings, potatoes and trees, eating in the Dining Hall, sleeping in the Great Hall, training at the Training Ground, auto-healing inside the walls, starting knowledge. Old world systems removed.
B. **Building and upgrading** — done. People start buildings on the plots when they know how and the wood is there. Materials are paid up front, and the site is finished by work that teaches Building. Upgrades work the same way. New discoveries lead to new buildings (listed below). Family houses on home plots go to couples, and are passed on when the owners die. Recipes go from boiled to mashed potatoes, then to bread once the Kitchen is Lv2, plus potato ale. The Carpentry Workshop makes tools that people pick up and wear out. The Library lets people study to discover techs. The Tavern lets people drink together. The Build omen is back. Births wait for food security.
C. **The Portal** — done. The player picks a party of 1–5 and an open floor from the Portal button (or by tapping the portal). The party walks to the portal and steps through together. They clear one room every half day, and each floor ends with a boss. Fights are turn-based and use stats, sword or bow, defense and wooden swords, and every blow goes into a battle report. Inside the dungeon, needs pause and wounds don't heal. The party flees when someone falls or the whole party is badly hurt, and turns back between rooms when anyone is below 20% HP. A hero is killed outright by a big enough blow. A fallen hero may be carried home but can bleed out on the way, and a party with nobody left standing is lost. Loot (meat, herbs, mushrooms, hide, bone, ore, mana crystals) goes to the stockpile, and dungeon food becomes new recipes: roast meat, mushroom soup and hearty stew. Beating a floor's boss opens the next floor. Floors: Mossy Burrows, Fungal Caverns, Bone Halls, The Deep Forge (a wall until there's real gear). The player can call a party home. Fighting side by side builds bonds.
D. **Depth from the dungeon** — done.
- Loot drives new discoveries:
  - **Smithing** from ore: a Blacksmith, iron swords, iron armour and iron axes.
  - **Herbalism** from herbs: an Infirmary where the wounded heal 3× faster, and herbal remedies that parties carry. A remedy heals the badly hurt and helps save the fallen.
  - **Arcane Arts** from mana crystals: a Mage Tower to practise **Magic**, a third fighting style (INT). Spells ignore armour, a practised mage mends allies, and crystals make mage staffs.
  - **Dungeon Cuisine**: meat pie and glowcap skewers. Bone broth uses up bone.
- Gear has slots (sword, bow, armour, staff). People keep their best, and fighting gear goes to those who have been through the portal, the most skilled first.
- Crafting ranks what is most worth making: medicine, then better gear, meals, simple tools and drink.
- Each floor has a recommended power, and the Portal panel rates the chosen party against it (ready, risky, deadly).
- Every person has a **life story**. Each log line that names someone becomes a chapter, and the story is kept after death.
- Balance: a hungry person eats before answering the portal's call, and couples wait while children outnumber the adults.
- Graphics and UI pass:
  - Map: people are drawn as little figures (tunic by specialty, grade outline, hair, walking bob, lying down to sleep), with leafy trees, potato plants and stockpile piles. Buildings have shadows, walls and doors, and there are grass tufts and flowers.
  - Atmosphere: day and night, seasonal tints, warm windows after dark, and a swirling portal.
  - UI: icons in the top bar and on the powers, news banners for big life events, portraits on the character sheet, and panel polish.
E. **Polish.** Art, sound, save slots, Capacitor APK.

## Open Questions

Answered: the player picks the portal party; the player stays an unseen god; 8 adults who have always lived there; keep the current pace.

1. **Who goes through the portal?** The player picks the party and floor (recommended, the most Pick Me Up–like), or the people volunteer on their own (brave, strong, bored).
2. **The player's role:** stay an unseen god with Faith and powers, or become the sanctuary's master who gives orders (build here, train this person)?
3. **Starting size:** 8 adults? Where do they come from (always there, or summoned into the sanctuary)?
4. **Pace:** each year is 30 minutes of real time at 1x now. Slower still, or keep it?
