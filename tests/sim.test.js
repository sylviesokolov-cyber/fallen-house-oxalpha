import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { prepareData } from '../src/sim/data.js';
import { createSim, stepSim } from '../src/sim/sim.js';
import { serialize, deserialize } from '../src/sim/save.js';
import { updateResources } from '../src/sim/world.js';
import { updateNeeds } from '../src/sim/needs.js';
import { gainXp, workTimeFactor } from '../src/sim/skills.js';
import { traitMod } from '../src/sim/traits.js';
import { changeBond, relationType, teach } from '../src/sim/bonds.js';
import { lifeStage, updateLifeCycle } from '../src/sim/lifecycle.js';
import { daysPerYear, dayIndexOf } from '../src/sim/time.js';
import { knows, learnTech, teachTech, updateDiscovery } from '../src/sim/techs.js';
import { isWarm, placeSite, wantedBuilding, workOnSite } from '../src/sim/buildings.js';
import { craftChoice, finishCraft, spoilFood, toolWorkFactor } from '../src/sim/items.js';
import { killHuman } from '../src/sim/human.js';

// A copy of the content with some settings overridden, for forcing rare events.
function tweak(path, value) {
  const copy = structuredClone({ ...data });
  let o = copy;
  const keys = path.split('.');
  for (const k of keys.slice(0, -1)) o = o[k];
  o[keys.at(-1)] = value;
  return copy;
}

const load = (name) => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
const data = prepareData(Object.fromEntries(['config', 'tiles', 'resources', 'names', 'traits', 'skills', 'techs', 'buildings', 'items'].map((n) => [n, load(n)])));
const run = (state, ticks) => { for (let i = 0; i < ticks; i++) stepSim(state, data); return state; };
const DAY = data.config.time.ticksPerDay;

test('same seed produces identical simulations', () => {
  const a = run(createSim(data, 'alpha'), 2000);
  const b = run(createSim(data, 'alpha'), 2000);
  assert.equal(serialize(a), serialize(b));
});

test('save/load resumes the exact same simulation', () => {
  const a = run(createSim(data, 'beta'), 600);
  const b = deserialize(serialize(a));
  run(a, 600);
  run(b, 600);
  assert.equal(serialize(a), serialize(b));
});

test('world has all Phase 1 tile types and berry bushes', () => {
  const s = createSim(data, 'gamma');
  for (const t of ['grass', 'water', 'forest', 'stone']) assert.ok(s.world.tiles.includes(t), t);
  assert.ok(s.world.resources.length > 20);
  assert.equal(s.humans.length, 10);
  assert.equal(s.history.filter((e) => e.text.endsWith('was born into the world')).length, 10);
});

test('humans eat and sleep, and most survive 10 days', () => {
  for (const seed of ['1', '2', '3', '4', '5']) {
    const s = createSim(data, seed);
    const seen = new Set();
    for (let i = 0; i < 10 * DAY; i++) {
      stepSim(s, data);
      for (const h of s.humans) seen.add(h.action.type);
    }
    assert.ok(seen.has('eat') && seen.has('sleep') && seen.has('wander'), `seed ${seed}: ${[...seen]}`);
    assert.ok(s.humans.length >= 8, `seed ${seed}: only ${s.humans.length} alive`);
  }
});

test('starvation kills and is logged', () => {
  const s = createSim(data, 'delta');
  s.world.resources = [];
  run(s, 8 * DAY);
  assert.equal(s.humans.length, 0);
  assert.ok(s.history.some((e) => e.text.includes('starved to death')));
});

test('humans gather wood and stone into the shared stockpile', () => {
  for (const seed of ['w1', 'w2', 'w3']) {
    const s = run(createSim(data, seed), 20 * DAY);
    assert.ok(s.stockpile.wood > 0 || s.stockpile.stone > 0, `seed ${seed}: stockpile stayed empty`);
  }
});

test('resource regrowth respects season and renewability', () => {
  const stub = { resourcesById: {
    berry_bush: { maxAmount: 4, regrowTicks: 10, seasonMultiplier: { Spring: 1, Winter: 0 } },
    stone_deposit: { maxAmount: 5 },
  } };
  const world = { resources: [
    { type: 'berry_bush', amount: 2, regrow: 0 },
    { type: 'stone_deposit', amount: 2, regrow: 0 },
  ] };
  for (let i = 0; i < 20; i++) updateResources(world, stub, 'Winter');
  assert.equal(world.resources[0].amount, 2, 'no berry regrowth in winter');
  assert.equal(world.resources[1].amount, 2, 'stone never regrows');
  for (let i = 0; i < 20; i++) updateResources(world, stub, 'Spring');
  assert.ok(world.resources[0].amount > 2, 'berries regrow in spring');
  assert.equal(world.resources[1].amount, 2, 'stone still never regrows');
});

test('winter cold makes humans hungrier faster', () => {
  const mk = () => ({ needs: { hunger: 100, energy: 100, social: 100 }, health: 100, traits: [], action: { type: 'wander' } });
  const summer = mk();
  const winter = mk();
  updateNeeds(summer, data, false);
  updateNeeds(winter, data, true);
  assert.ok(winter.needs.hunger < summer.needs.hunger);
});

test('every human gets 1-3 non-contradictory traits', () => {
  const s = createSim(data, 'traits');
  for (const h of s.humans) {
    assert.ok(h.traits.length >= 1 && h.traits.length <= 3, h.name);
    assert.equal(new Set(h.traits).size, h.traits.length);
    for (const t of h.traits) assert.ok(!h.traits.includes(data.traitsById[t].opposite), `${h.name}: ${h.traits}`);
  }
});

test('nobody starts skilled; skills are learned by doing', () => {
  const s = createSim(data, 'skills');
  for (const h of s.humans) assert.deepEqual(h.skills, {});
  run(s, 20 * DAY);
  const learned = s.humans.filter((h) => Object.values(h.skills).some((k) => k.level >= 1));
  assert.ok(learned.length >= 5, `only ${learned.length} learned anything`);
});

test('traits change learning speed, and levelling up logs milestones', () => {
  const s = createSim(data, 'xp');
  const [a, b] = s.humans;
  a.traits = ['clever'];
  b.traits = [];
  a.skills = {};
  b.skills = {};
  for (let i = 0; i < 20; i++) {
    gainXp(s, data, a, 'woodcutting', 4);
    gainXp(s, data, b, 'woodcutting', 4);
  }
  assert.ok(a.skills.woodcutting.level > b.skills.woodcutting.level);
  assert.ok(s.history.some((e) => e.text === `${a.name} became a capable woodcutter`));
  assert.ok(workTimeFactor(a, data, 'woodcutting') < workTimeFactor(b, data, 'woodcutting'));
  assert.equal(traitMod(b, data, 'learnRate'), 1);
});

test('interrupted hauls are finished, so the stockpile keeps growing', () => {
  for (const seed of ['a', 'c']) {
    const s = run(createSim(data, seed), 60 * DAY);
    const before = s.stockpile.wood + s.stockpile.stone;
    run(s, 60 * DAY);
    assert.ok(s.stockpile.wood + s.stockpile.stone > before, `seed ${seed} stalled at ${before}`);
  }
});

test('relationship types follow bond value, partners and family', () => {
  const s = createSim(data, 'rel');
  const [a, b, c] = s.humans;
  assert.equal(relationType(s, data, a, b), 'stranger');
  changeBond(s, data, a, b, 35);
  assert.equal(relationType(s, data, a, b), 'friend');
  assert.ok(s.history.some((e) => e.text === `${a.name} and ${b.name} became friends`));
  changeBond(s, data, a, c, -40);
  assert.equal(relationType(s, data, a, c), 'rival');
  a.partnerId = b.id;
  b.partnerId = a.id;
  assert.equal(relationType(s, data, a, b), 'partner');
  c.parents = [a.id];
  assert.equal(relationType(s, data, a, c), 'family');
});

test('friends teach their best skills; strangers do not', () => {
  const s = createSim(data, 'teach');
  const [t, friend, stranger] = s.humans;
  for (const h of [t, friend, stranger]) h.skills = {};
  t.skills.woodcutting = { level: 5, xp: 0 };
  teach(s, data, t, stranger);
  assert.equal(stranger.skills.woodcutting, undefined);
  changeBond(s, data, t, friend, 50);
  teach(s, data, t, friend);
  assert.ok(friend.skills.woodcutting.xp > 0 || friend.skills.woodcutting.level > 0);
  assert.ok(t.skills.teaching.xp > 0);
});

test('a fed couple has a child who inherits family ties and valid traits', () => {
  const fast = { ...data, config: { ...data.config, lifecycle: { ...data.config.lifecycle, birthChancePerDay: 1, gestationDays: 2 } } };
  const s = createSim(fast, 'baby');
  const mother = s.humans.find((h) => h.sex === 'female');
  const father = s.humans.find((h) => h.sex === 'male');
  mother.partnerId = father.id;
  father.partnerId = mother.id;
  const before = s.humans.length;
  run(s, 1);
  for (let d = 0; d < 4; d++) {
    s.tick += data.config.time.ticksPerDay - (s.tick % data.config.time.ticksPerDay);
    mother.needs.hunger = father.needs.hunger = 100;
    updateLifeCycle(s, fast);
  }
  assert.equal(s.humans.length, before + 1);
  const child = s.humans.at(-1);
  assert.deepEqual(child.parents, [mother.id, father.id]);
  assert.equal(lifeStage(child, s, fast), 'child');
  assert.ok(child.traits.length >= 1 && child.traits.length <= 3);
  for (const t of child.traits) assert.ok(!child.traits.includes(data.traitsById[t].opposite));
  assert.equal(relationType(s, fast, mother, child), 'family');
  assert.ok(s.history.some((e) => e.text.startsWith(`${mother.name} and ${father.name} had a`)));
});

test('the very old die of old age and leave their partner widowed', () => {
  const s = createSim(data, 'old');
  const [elder, partner] = s.humans;
  elder.birthDay = dayIndexOf(s.tick, data.config.time) - 95 * daysPerYear(data.config.time);
  elder.partnerId = partner.id;
  partner.partnerId = elder.id;
  run(s, 90 * DAY);
  assert.ok(s.dead.some((d) => d.id === elder.id && d.cause === 'old age'));
  assert.equal(partner.partnerId, null);
  assert.ok(s.history.some((e) => e.text.startsWith(`${elder.name} died of old age`)));
});

test('over the years people befriend, pair up, have children; children never haul', () => {
  const s = createSim(data, 'a');
  const childActions = new Set();
  for (let i = 0; i < 4 * 60 * DAY; i++) {
    stepSim(s, data);
    if (i % 20 === 0) for (const h of s.humans) if (lifeStage(h, s, data) === 'child') childActions.add(h.action.type);
  }
  for (const text of ['became friends', 'became partners', ' had a ']) {
    assert.ok(s.history.some((e) => e.text.includes(text)), text);
  }
  assert.ok(childActions.size > 0);
  for (const a of ['gather', 'harvest', 'deposit']) assert.ok(!childActions.has(a), a);
});

test('techs are discovered when conditions are met, never before prerequisites', () => {
  const sure = tweak('techsById.stone_tools.discovery.baseChance', 1);
  sure.techsById.cooking.discovery.baseChance = 1;
  sure.techs = sure.techs.map((t) => sure.techsById[t.id]);
  const s = createSim(sure, 'disc');
  const h = s.humans[0];
  h.knows = [];
  h.skills = { mining: { level: 2, xp: 0 }, foraging: { level: 5, xp: 0 } };
  h.counters = { 'gather:stone': 20 };
  s.tick = 10 * sure.config.discovery.checkEveryTicks;
  updateDiscovery(s, sure);
  assert.ok(knows(h, 'stone_tools'));
  assert.ok(!knows(h, 'cooking'), 'cooking needs fire first');
  assert.ok(s.history.some((e) => e.text === `${h.name} discovered Stone Tools`));
});

test('knowledge dies with its last holder, and is kept while someone knows it', () => {
  const s = createSim(data, 'lost');
  const [a, b, c] = s.humans;
  for (const h of s.humans) h.knows = [];
  learnTech(s, data, a, 'fire');
  learnTech(s, data, b, 'fire');
  learnTech(s, data, c, 'basketry');
  killHuman(s, data, a, 'starvation');
  assert.ok(!s.discoveries.fire.lost);
  killHuman(s, data, c, 'starvation');
  assert.ok(s.discoveries.basketry.lost);
  assert.ok(s.history.some((e) => e.text === `The knowledge of Basketry died with ${c.name}`));
  learnTech(s, data, b, 'basketry');
  assert.ok(s.history.some((e) => e.text === `${b.name} rediscovered Basketry`));
});

test('teaching passes on techs the student is ready for', () => {
  const sure = tweak('config.discovery.teachTechChance', 1);
  const s = createSim(sure, 'teachtech');
  const [t, st] = s.humans;
  t.knows = ['fire', 'cooking'];
  st.knows = [];
  teachTech(s, sure, t, st, 1);
  assert.deepEqual(st.knows, ['fire']);
  teachTech(s, sure, t, st, 1);
  assert.deepEqual(st.knows, ['fire', 'cooking']);
});

test('people who know Fire build a campfire that keeps them warm', () => {
  const s = createSim(data, 'build');
  const h = s.humans[0];
  h.knows = ['fire'];
  s.stockpile.wood = 20;
  const def = wantedBuilding(s, data, h);
  assert.equal(def.id, 'campfire');
  const site = placeSite(s, data, def);
  assert.equal(s.stockpile.wood, 12);
  while (!workOnSite(s, data, h, site));
  assert.ok(site.built);
  assert.ok(s.history.some((e) => e.text === `${h.name} finished building a Campfire`));
  h.x = site.x;
  h.y = site.y;
  assert.ok(isWarm(s, data, h));
  assert.equal(wantedBuilding(s, data, h), null, 'one campfire is enough for 10 people');
});

test('a farm plot becomes a field that grows food', () => {
  const s = createSim(data, 'farm');
  const h = s.humans[0];
  h.knows = ['basketry', 'farming'];
  s.stockpile.wood = 10;
  const site = placeSite(s, data, data.buildingsById.farm_plot);
  while (!workOnSite(s, data, h, site));
  const crop = s.world.resources.find((r) => r.type === 'crop' && r.x === site.x && r.y === site.y);
  assert.ok(crop);
  run(s, 3 * DAY);
  assert.ok(crop.amount > 0);
});

test('stone axes are crafted from the stockpile and speed up woodcutting', () => {
  const s = createSim(data, 'craft');
  const h = s.humans[0];
  h.knows = ['stone_tools'];
  h.skills = { woodcutting: { level: 1, xp: 0 } };
  s.stockpile.stone = 2;
  s.stockpile.wood = 1;
  const def = craftChoice(s, data, h);
  assert.equal(def.id, 'stone_axe');
  assert.ok(finishCraft(s, data, h, def));
  assert.equal(s.stockpile.stone, 0);
  assert.equal(h.tools.stone_axe, def.durability);
  assert.ok(toolWorkFactor(h, data, 'woodcutting') < 1);
  assert.equal(craftChoice(s, data, h), null);
});

test('stored food spoils, and a storage pit slows it', () => {
  const s = createSim(data, 'spoil');
  s.tick = DAY;
  s.stockpile.food = 1000;
  spoilFood(s, data);
  const plainLoss = 1000 - s.stockpile.food;
  s.buildings.push({ id: 99, type: 'storage_pit', x: 0, y: 0, built: true, work: 0 });
  s.stockpile.food = 1000;
  spoilFood(s, data);
  const pitLoss = 1000 - s.stockpile.food;
  assert.ok(plainLoss > 0 && pitLoss < plainLoss, `${plainLoss} vs ${pitLoss}`);
});

test('over a few years a tribe discovers techs, builds, and stores food', () => {
  const s = createSim(data, 'a');
  let storedFood = false;
  for (let d = 0; d < 4 * 60; d++) {
    run(s, DAY);
    if (s.stockpile.food + s.stockpile.cooked_food > 0) storedFood = true;
  }
  assert.ok(Object.keys(s.discoveries).length >= 5, Object.keys(s.discoveries).join());
  assert.ok(s.buildings.some((b) => b.built));
  assert.ok(storedFood);
});

test('sim code has no Phaser or unseeded randomness', () => {
  const dir = new URL('../src/sim/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    assert.ok(!/Math\.random|Phaser|document\.|window\.|localStorage/.test(src), f);
  }
});
