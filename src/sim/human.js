import { chance, next, pick, randInt } from './rng.js';
import { bfs } from './pathfinding.js';
import { tileIndex } from './world.js';
import { ageInYears, dayIndexOf, daysPerYear } from './time.js';
import { logEvent } from './history.js';
import { rollTraits } from './traits.js';
import { forgetOnDeath } from './techs.js';
import { addFeeling } from './mood.js';
import { newHeroFields } from './stats.js';

function uniqueName(state, data, sex) {
  const used = new Set(state.humans.map((h) => h.name));
  for (let tries = 0; tries < 10; tries++) {
    const name = pick(state.rng, data.names[sex]);
    if (!used.has(name)) return name;
  }
  return pick(state.rng, data.names[sex]);
}

// Who someone can fall for: 'opposite', 'same' or 'both', weighted by config.
function rollAttraction(rng, weights) {
  let r = next(rng);
  for (const [kind, w] of Object.entries(weights)) {
    if ((r -= w) < 0) return kind;
  }
  return 'opposite';
}

// opts.ageYears: 0 for a newborn (born today); omitted for a random starting adult.
export function createHuman(state, data, x, y, opts = {}) {
  const { rng } = state;
  const cfg = data.config.humans;
  const sex = chance(rng, 0.5) ? 'female' : 'male';
  const yearLen = daysPerYear(data.config.time);
  const today = dayIndexOf(state.tick, data.config.time);
  const birthDay = opts.ageYears === 0
    ? today
    : today - randInt(rng, cfg.startAgeMin, cfg.startAgeMax) * yearLen - randInt(rng, 0, yearLen - 1);
  return {
    id: state.nextId++,
    name: uniqueName(state, data, sex),
    sex,
    birthDay,
    attraction: rollAttraction(rng, cfg.attraction),
    parents: opts.parents ?? [],
    partnerId: null,
    pregnantUntil: null,
    lastBirthDay: null,
    x,
    y,
    prevX: x,
    prevY: y,
    stepTick: 0,
    nextMoveTick: 0,
    nextFoodSearch: 0,
    nextResourceSearch: 0,
    needs: { hunger: randInt(rng, 55, 100), energy: randInt(rng, 50, 100), social: randInt(rng, 50, 100) },
    health: 100,
    ...newHeroFields(state, data, opts.grade),
    traits: opts.traits ?? rollTraits(state, data),
    skills: {},
    knows: [],
    tools: {},
    counters: {},
    devotion: randInt(rng, 0, data.config.devotion.startMax),
    nextPrayer: 0,
    status: {},
    feelings: [],
    carrying: null,
    action: { type: 'idle', ticks: randInt(rng, 1, 8) },
  };
}

// Finds the grass tile closest to the map center, places the tribe's shared
// stockpile there, then places humans on random walkable tiles nearby.
export function spawnInitialHumans(state, data) {
  const { world } = state;
  const cfg = data.config.humans;
  const cx = Math.floor(world.width / 2);
  const cy = Math.floor(world.height / 2);
  let center = tileIndex(world, cx, cy);
  let best = Infinity;
  for (let i = 0; i < world.tiles.length; i++) {
    if (world.tiles[i] !== 'grass') continue;
    const d = Math.abs((i % world.width) - cx) + Math.abs(Math.floor(i / world.width) - cy);
    if (d < best) {
      best = d;
      center = i;
    }
  }
  state.stockpile = { x: center % world.width, y: Math.floor(center / world.width), wood: 0, stone: 0, clay: 0, food: 0, pottery: 0, cooked_food: 0 };

  const spots = bfs(world, data, center, { maxDist: cfg.spawnRadius }).reached;
  for (let n = 0; n < cfg.startCount; n++) {
    const i = spots.length > 1 ? spots.splice(randInt(state.rng, 0, spots.length - 1), 1)[0] : center;
    const h = createHuman(state, data, i % world.width, Math.floor(i / world.width));
    state.humans.push(h);
    logEvent(state, `${h.name} was born into the world`);
  }
}

export function humanAge(h, state, data) {
  return ageInYears(h.birthDay, state.tick, data.config.time);
}

const DEATH_TEXT = {
  starvation: (name, age) => `${name} starved to death, aged ${age}`,
  'old age': (name, age) => `${name} died of old age, aged ${age}`,
  lightning: (name, age) => `${name} was struck down by lightning, aged ${age}`,
};

export function killHuman(state, data, h, cause) {
  const age = humanAge(h, state, data);
  state.humans = state.humans.filter((o) => o.id !== h.id);
  state.dead.push({
    id: h.id, name: h.name, sex: h.sex, birthDay: h.birthDay, parents: h.parents, partnerId: h.partnerId,
    grade: h.grade, level: h.level, stats: h.stats,
    traits: h.traits, skills: h.skills, knows: h.knows, deathTick: state.tick, cause,
  });
  const partner = state.humans.find((o) => o.id === h.partnerId);
  if (partner) partner.partnerId = null;
  let text = (DEATH_TEXT[cause] ?? ((n, a) => `${n} died (${cause}), aged ${a}`))(h.name, age);
  if (partner) text += `, leaving behind ${partner.name}`;
  logEvent(state, text);
  forgetOnDeath(state, data, h);
  // Partner, parents, children and siblings grieve.
  const m = data.config.mood;
  for (const o of state.humans) {
    const family = o.partnerId === h.id || o.parents.includes(h.id) || h.parents.includes(o.id)
      || o.parents.some((p) => h.parents.includes(p));
    if (family || partner === o) addFeeling(state, data, o, `Grieving ${h.name}`, m.griefValue, m.griefDays, 'grief');
  }
}
