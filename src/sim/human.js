import { chance, next, pick, randInt } from './rng.js';
import { ageInYears, dayIndexOf, daysPerYear } from './time.js';
import { addStory, logEvent } from './history.js';
import { rollTraits } from './traits.js';
import { forgetOnDeath } from './techs.js';
import { addFeeling } from './mood.js';
import { newHeroFields } from './stats.js';
import { rollLooks, rollPreference } from './appeal.js';
import { widow } from './dynasty.js';

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
    consorts: [],
    house: opts.house ?? null,
    looks: rollLooks(state, opts.parentsList ?? []),
    drawnTo: rollPreference(state, data),
    eternal: false,
    sick: null,
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
    story: [],
    called: null,
    away: null,
    action: { type: 'idle', ticks: randInt(rng, 1, 8) },
  };
}

// The first people have always lived in the sanctuary: they wake in the Great
// Hall knowing the basics (the techs marked `starting`).
export function spawnInitialHumans(state, data) {
  const cfg = data.config.humans;
  const L = data.sanctuary;
  state.stockpile = { x: L.stockpile.x, y: L.stockpile.y, wood: 0, food: data.config.food.startStock };
  for (const def of data.items) state.stockpile[def.id] = 0;
  const hall = state.buildings.find((b) => data.buildingsById[b.type].effects.sleepers);
  const basics = data.techs.filter((t) => t.starting).map((t) => t.id);
  for (const id of basics) state.discoveries[id] = { by: 'the first people', tick: 0, lost: false };
  for (let n = 0; n < cfg.startCount; n++) {
    const x = randInt(state.rng, hall.rx, hall.rx + hall.w - 1);
    const y = randInt(state.rng, hall.ry, hall.ry + hall.h - 1);
    const h = createHuman(state, data, x, y, { house: freshHouse(state, data) });
    h.knows = [...basics];
    state.humans.push(h);
    logEvent(state, `${h.name} awoke in ${state.settlement.name}`);
  }
}

// A family name nobody living has yet.
export function freshHouse(state, data) {
  const used = new Set(state.humans.map((h) => h.house));
  const free = data.names.houses.filter((n) => !used.has(n));
  return pick(state.rng, free.length ? free : data.names.houses);
}

export function humanAge(h, state, data) {
  return ageInYears(h.birthDay, state.tick, data.config.time);
}

const DEATH_TEXT = {
  starvation: (name, age) => `${name} starved to death, aged ${age}`,
  'old age': (name, age) => `${name} died of old age, aged ${age}`,
  dungeon: (name, age, detail) => `${name} ${detail}, aged ${age}`,
  raid: (name, age, detail) => `${name} ${detail}, aged ${age}`,
  sickness: (name, age) => `${name} died of the sickness, aged ${age}`,
};

// `detail` finishes the log line for some causes (how they died in the dungeon).
export function killHuman(state, data, h, cause, detail) {
  const age = humanAge(h, state, data);
  state.humans = state.humans.filter((o) => o.id !== h.id);
  state.dead.push({
    id: h.id, name: h.name, sex: h.sex, birthDay: h.birthDay, parents: h.parents, partnerId: h.partnerId,
    grade: h.grade, level: h.level, stats: h.stats,
    traits: h.traits, skills: h.skills, knows: h.knows, deathTick: state.tick, cause, story: h.story,
    house: h.house, looks: h.looks, consorts: h.consorts,
  });
  const record = state.dead.at(-1);
  const spouses = widow(state, h);
  const partner = spouses[0] ?? null;
  let text = (DEATH_TEXT[cause] ?? ((n, a) => `${n} died (${cause}), aged ${a}`))(h.name, age, detail);
  if (spouses.length) text += `, leaving behind ${spouses.map((o) => o.name).join(' and ')}`;
  logEvent(state, text);
  addStory(record, { tick: state.tick, text });
  forgetOnDeath(state, data, h);
  // Partner, parents, children and siblings grieve.
  const m = data.config.mood;
  for (const o of state.humans) {
    const family = spouses.includes(o) || o.parents.includes(h.id) || h.parents.includes(o.id)
      || o.parents.some((p) => h.parents.includes(p));
    if (!family) continue;
    addFeeling(state, data, o, `Grieving ${h.name}`, m.griefValue, m.griefDays, 'grief');
    if (!spouses.includes(o)) addStory(o, { tick: state.tick, text: `Mourned ${h.name}` });
  }
}
