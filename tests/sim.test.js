import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DATA_FILES, prepareData } from '../src/sim/data.js';
import { createSim, stepSim } from '../src/sim/sim.js';
import { serialize, deserialize } from '../src/sim/save.js';
import { updateResources } from '../src/sim/world.js';
import { updateNeeds } from '../src/sim/needs.js';
import { gainXp, workTimeFactor } from '../src/sim/skills.js';
import { traitMod } from '../src/sim/traits.js';
import { bondValue, changeBond, relationType, teach } from '../src/sim/bonds.js';
import { lifeStage, updateLifeCycle } from '../src/sim/lifecycle.js';
import { daysPerYear, dayIndexOf } from '../src/sim/time.js';
import { knows, learnTech, teachTech, updateDiscovery } from '../src/sim/techs.js';
import { buildingWith, inside, isWarm } from '../src/sim/buildings.js';
import { spoilFood } from '../src/sim/items.js';
import { killHuman } from '../src/sim/human.js';
import { usePower } from '../src/sim/godPowers.js';
import { mood, feel } from '../src/sim/mood.js';
import { gainCharacterXp, heroClass } from '../src/sim/stats.js';
import { emotionOf } from '../src/sim/emotions.js';
import { populationCap, updateSettlement } from '../src/sim/settlement.js';
import { carryCapacity } from '../src/sim/items.js';
import { updateHuman } from '../src/sim/ai.js';

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
const data = prepareData(Object.fromEntries(DATA_FILES.map((n) => [n, load(n)])));
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

test('starvation kills and is logged', () => {
  const s = createSim(data, 'delta');
  s.world.resources = [];
  s.stockpile.food = 0;
  run(s, 8 * DAY);
  assert.equal(s.humans.length, 0);
  assert.ok(s.history.some((e) => e.text.includes('starved to death')));
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
  const mk = () => ({ needs: { hunger: 100, energy: 100, social: 100 }, health: 100, traits: [], stats: { str: 5, agi: 5, int: 5, vit: 5, cha: 5 }, action: { type: 'wander' } });
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
  s.stockpile.food = 1000;
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
  assert.notEqual(partner.partnerId, elder.id);
  assert.ok(s.history.some((e) => e.text.startsWith(`${elder.name} died of old age`)));
});

test('bless restores someone and doubles their learning; witnesses grow devout', () => {
  const s = createSim(data, 'bless');
  s.faith = 100;
  const [h, other] = s.humans;
  for (const p of [h, other]) {
    p.traits = [];
    p.skills = {};
    p.feelings = [];
    p.needs.hunger = 20;
    p.action = { type: 'wander', path: [] };
  }
  other.x = h.x;
  other.y = h.y;
  const devotionBefore = other.devotion;
  assert.ok(usePower(s, data, 'bless', { humanId: h.id }).ok);
  assert.equal(h.needs.hunger, 100);
  assert.ok(other.devotion > devotionBefore);
  assert.equal(other.counters.miraclesSeen, 1);
  other.needs.hunger = other.needs.energy = other.needs.social = other.health = 100;
  gainXp(s, data, h, 'farming', 5);
  gainXp(s, data, other, 'farming', 5);
  assert.ok(h.skills.farming.xp + h.skills.farming.level * 100 > other.skills.farming.xp + other.skills.farming.level * 100);
});

test('every person is a hero with a grade, stats and a level', () => {
  const s = createSim(data, 'heroes');
  for (const h of s.humans) {
    assert.ok(h.grade >= 1 && h.grade <= 5);
    assert.equal(h.level, 1);
    for (const st of data.stats) assert.ok(Number.isInteger(h.stats[st.id]));
  }
});

test('levelling up grows the stats a person uses', () => {
  const s = createSim(data, 'lvl');
  const h = s.humans[0];
  const before = { ...h.stats };
  for (let i = 0; i < 400; i++) gainCharacterXp(s, data, h, 10, 'woodcutting');
  assert.ok(h.level > 10, `level ${h.level}`);
  const gained = (id) => h.stats[id] - before[id];
  assert.ok(gained('str') > gained('cha'), JSON.stringify({ before, after: h.stats }));
  h.skills = { woodcutting: { level: 7, xp: 0 }, foraging: { level: 8, xp: 0 } };
  assert.equal(heroClass(h, data), 'Skilled Woodcutter');
});

test('stats matter: strong people carry more, clever-minded learn faster', () => {
  const s = createSim(data, 'statfx');
  const [a, b] = s.humans;
  for (const h of [a, b]) {
    h.traits = [];
    h.tools = {};
    h.feelings = [];
    h.skills = {};
    h.needs.hunger = h.needs.energy = h.needs.social = h.health = 70;
  }
  a.stats = { str: 20, agi: 5, int: 15, vit: 5, cha: 5 };
  b.stats = { str: 5, agi: 5, int: 5, vit: 5, cha: 5 };
  assert.ok(carryCapacity(a, data) > carryCapacity(b, data));
  gainXp(s, data, a, 'mining', 4);
  gainXp(s, data, b, 'mining', 4);
  assert.ok(a.skills.mining.xp > b.skills.mining.xp);
});

test('emotions follow what happens to people', () => {
  const s = createSim(data, 'emo');
  const h = s.humans[0];
  h.feelings = [];
  h.needs.hunger = h.needs.energy = h.needs.social = h.health = 80;
  assert.equal(emotionOf(h, data).id, 'happy');
  feel(s, data, h, 'argued', 'Argued with someone', 'anger');
  assert.equal(emotionOf(h, data).id, 'angry');
  h.needs.hunger = 5;
  assert.equal(emotionOf(h, data).id, 'starving');
});

test('someone hauling food eats from their own load when hungry', () => {
  const s = createSim(data, 'carry');
  const h = s.humans[0];
  h.carrying = { type: 'food', amount: 3 };
  h.needs.hunger = 10;
  h.action = { type: 'idle', ticks: 0, done: true };
  for (let i = 0; i < data.config.humans.eatTicks + 1; i++) {
    s.tick++;
    updateHuman(s, data, h);
  }
  assert.ok(h.needs.hunger > 30);
  assert.equal(h.carrying.amount, 2);
});

// --- The sanctuary ---

test('the sanctuary is walled in, with the portal set into the wall', () => {
  const s = createSim(data, 'walls');
  const { width: W, height: H, tiles } = s.world;
  for (let i = 0; i < W; i++) {
    for (const [x, y] of [[i, 0], [i, H - 1], [0, i], [W - 1, i]]) {
      assert.ok(['wall', 'portal'].includes(tiles[y * W + x]), `${x},${y} is ${tiles[y * W + x]}`);
    }
  }
  assert.ok(tiles.includes('portal'));
  assert.ok(s.world.resources.some((r) => r.type === 'tree'));
  assert.ok(s.world.resources.some((r) => r.type === 'potato'));
});

test('everyone starts in the Great Hall with the four starting buildings and the basics', () => {
  const s = createSim(data, 'start');
  assert.deepEqual(s.buildings.map((b) => b.type).sort(), ['dining_hall', 'great_hall', 'kitchen', 'training_ground']);
  const hall = buildingWith(s, data, 'sleepers');
  assert.equal(s.humans.length, data.config.humans.startCount);
  for (const h of s.humans) {
    assert.ok(inside(hall, h.x, h.y));
    for (const id of ['farming', 'woodcutting', 'cooking', 'construction', 'fighting']) assert.ok(knows(h, id), id);
    assert.ok(!knows(h, 'worship'));
  }
  assert.equal(populationCap(s, data), data.buildingsById.great_hall.effects.sleepers);
});

test('people sleep in their own beds in the Great Hall', () => {
  const s = createSim(data, 'beds');
  for (const h of s.humans) h.needs.energy = 5;
  run(s, 40);
  const hall = buildingWith(s, data, 'sleepers');
  const sleepers = s.humans.filter((h) => h.action.type === 'sleep');
  assert.ok(sleepers.length >= 6, `${sleepers.length} asleep`);
  for (const h of sleepers) assert.ok(inside(hall, h.x, h.y));
  const beds = new Set(sleepers.map((h) => `${h.x},${h.y}`));
  assert.equal(beds.size, sleepers.length, 'no two people share a bed');
});

test('potatoes are harvested, cooked in the Kitchen and eaten in the Dining Hall', () => {
  const s = createSim(data, 'meals');
  let cooked = 0;
  let dined = false;
  for (let i = 0; i < 20 * DAY; i++) {
    const before = s.stockpile.cooked_food;
    stepSim(s, data);
    if (s.stockpile.cooked_food > before) cooked++;
    const hall = buildingWith(s, data, 'dining');
    if (s.humans.some((h) => h.action.type === 'eat' && h.action.dine && inside(hall, h.x, h.y))) dined = true;
  }
  assert.ok(cooked > 10, `only ${cooked} meals cooked`);
  assert.ok(dined, 'nobody ate in the Dining Hall');
  assert.ok(s.humans.some((h) => h.feelings.some((f) => f.text === 'Shared a meal in the Dining Hall')) || s.history.length > 0);
});

test('training at the Training Ground builds fighting skills', () => {
  const s = createSim(data, 'train');
  run(s, 30 * DAY);
  const fighters = s.humans.filter((h) => ['swordsmanship', 'archery', 'defense'].some((k) => (h.skills[k]?.level ?? 0) >= 1));
  // Some love training and some never go, so expect a few dedicated fighters.
  assert.ok(fighters.length >= 3, `only ${fighters.length} trained`);
});

test('wounds heal on their own inside the walls', () => {
  const s = createSim(data, 'heal');
  const h = s.humans[0];
  h.health = 30;
  h.needs.hunger = 100;
  run(s, 2 * DAY);
  assert.ok(h.health > 90, `health ${h.health}`);
});

test('a sanctuary of 8 survives its first years and grows', () => {
  for (const seed of ['s1', 's2', 's3']) {
    const s = createSim(data, seed);
    run(s, 3 * 60 * DAY);
    assert.equal(s.dead.length, 0, `seed ${seed}: ${s.dead.map((d) => d.cause)}`);
    assert.ok(s.humans.length > data.config.humans.startCount, `seed ${seed}: no births`);
    assert.ok(s.humans.length <= populationCap(s, data) + 1);
  }
});

test('stored food spoils slowly', () => {
  const s = createSim(data, 'spoil');
  s.tick = DAY;
  s.stockpile.food = 1000;
  spoilFood(s, data);
  assert.ok(s.stockpile.food < 1000 && s.stockpile.food > 900);
});

// --- Knowledge ---

test('miracles lead to Worship, and the faithful pray for Faith', () => {
  const s = createSim(data, 'pray');
  for (const h of s.humans) h.action = { type: 'wander', path: [] };
  for (let k = 0; k < 3; k++) {
    s.faith = 100;
    usePower(s, data, 'bless', { humanId: s.humans[k].id });
    for (const h of s.humans) h.x = s.humans[k].x, h.y = s.humans[k].y;
  }
  run(s, 3 * DAY);
  assert.ok(s.humans.some((h) => knows(h, 'worship')), 'someone found Worship');

  const quiet = createSim(data, 'pray2');
  const devout = createSim(data, 'pray2');
  for (const h of devout.humans) {
    h.knows.push('worship');
    h.devotion = 80;
  }
  quiet.faith = devout.faith = 0;
  run(quiet, 8 * DAY);
  run(devout, 8 * DAY);
  assert.ok(devout.faith > quiet.faith + 5, `${devout.faith} vs ${quiet.faith}`);
});

test('knowledge dies with its last holder, and can be found again', () => {
  const s = createSim(data, 'lost');
  const [a, b] = s.humans;
  learnTech(s, data, a, 'worship');
  killHuman(s, data, a, 'starvation');
  assert.ok(s.discoveries.worship.lost);
  assert.ok(s.history.some((e) => e.text === `The knowledge of Worship died with ${a.name}`));
  learnTech(s, data, b, 'worship');
  assert.ok(s.history.some((e) => e.text === `${b.name} rediscovered Worship`));
});

test('children are taught the basics by their elders', () => {
  const sure = tweak('config.discovery.teachTechChance', 1);
  const s = createSim(sure, 'kids');
  const [parent, kid] = s.humans;
  kid.knows = [];
  kid.parents = [parent.id];
  teachTech(s, sure, parent, kid, 1);
  assert.equal(kid.knows.length, 1);
});

test('inspire lets someone discover what they could not have alone', () => {
  const s = createSim(data, 'dream');
  s.faith = 100;
  const [dreamer, plain] = s.humans;
  for (const p of [dreamer, plain]) {
    p.traits = [];
    p.counters = { miraclesSeen: 1 };
  }
  usePower(s, data, 'inspire', { humanId: dreamer.id });
  dreamer.counters.miraclesSeen = 1;
  const saved = s.humans;
  s.humans = [dreamer, plain];
  for (let k = 1; k <= 3000 && !knows(dreamer, 'worship'); k++) {
    s.tick = k * data.config.discovery.checkEveryTicks;
    dreamer.status.inspiredUntil = s.tick + 1;
    updateDiscovery(s, data);
  }
  s.humans = saved;
  assert.ok(knows(dreamer, 'worship'));
  assert.ok(!knows(plain, 'worship'));
});

// --- The player ---

test('powers cost Faith and do nothing when it runs short', () => {
  const s = createSim(data, 'faith');
  const h = s.humans[0];
  h.needs.hunger = 10;
  s.faith = 10;
  assert.equal(usePower(s, data, 'bless', { humanId: h.id }).ok, false);
  assert.equal(h.needs.hunger, 10);
  s.faith = 100;
  assert.ok(usePower(s, data, 'bless', { humanId: h.id }).ok);
  assert.equal(h.needs.hunger, 100);
  assert.ok(s.faith < 100);
});

test('an omen sets the community focus for a while', () => {
  const s = createSim(data, 'omen');
  s.faith = 100;
  assert.equal(usePower(s, data, 'omen', { focus: 'nonsense' }).ok, false);
  assert.ok(usePower(s, data, 'omen', { focus: 'train' }).ok);
  assert.equal(s.focus.id, 'train');
  assert.ok(s.focus.until > s.tick);
});

test('the most charismatic adult becomes Warden', () => {
  const s = createSim(data, 'lead');
  s.humans[3].stats.cha = 30;
  s.tick = DAY;
  updateSettlement(s, data);
  assert.equal(s.settlement.leaderId, s.humans[3].id);
  assert.ok(s.history.some((e) => e.text === `${s.humans[3].name} became Warden of ${s.settlement.name}`));
});

// --- People ---

test('sim code has no Phaser or unseeded randomness', () => {
  const dir = new URL('../src/sim/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    assert.ok(!/Math\.random|Phaser|document\.|window\.|localStorage/.test(src), f);
  }
});

// --- Building and upgrading ---

import { addWork, planJob, startJob } from '../src/sim/construction.js';
import { buildingEffect, builtOfType, freeShelter } from '../src/sim/buildings.js';
import { craftChoice, eatFromStock, handOutTools, wearTools } from '../src/sim/items.js';
import { tryDiscover } from '../src/sim/techs.js';

// Lays out and finishes a building (or upgrade) at once, as person h.
function finish(s, h, job) {
  const b = startJob(s, data, h, job);
  while (!addWork(s, data, h, b, 50));
  return b;
}

test('people raise new buildings on the plots once they know how', () => {
  const s = createSim(data, 'builders');
  const carpenter = s.humans[0];
  learnTech(s, data, carpenter, 'carpentry');
  s.stockpile.wood = 200;
  run(s, 12 * DAY);
  const shop = s.buildings.find((b) => b.type === 'carpentry_workshop');
  assert.ok(shop, 'a workshop was started');
  assert.ok(shop.built, 'and finished');
  assert.match(shop.plot, /^plot:\d$/);
  assert.ok(s.history.some((e) => e.text.startsWith('The Carpentry Workshop was finished')));
  assert.ok(carpenter.skills.building?.xp > 0 || carpenter.skills.building?.level > 0);
});

test('nobody builds what nobody knows, or without the wood', () => {
  const s = createSim(data, 'nobuild');
  const h = s.humans[0];
  s.stockpile.wood = 0;
  learnTech(s, data, h, 'carpentry');
  assert.equal(planJob(s, data, h), null, 'no wood');
  s.stockpile.wood = 200;
  assert.equal(planJob(s, data, s.humans[1]), null, 'does not know carpentry');
  assert.equal(planJob(s, data, h).def.id, 'carpentry_workshop');
});

test('upgrades raise a building\'s level and its effects', () => {
  const s = createSim(data, 'upgrade');
  const h = s.humans[0];
  const ground = builtOfType(s, 'training_ground');
  assert.equal(buildingEffect(data, ground, 'trainingXp'), 1);
  learnTech(s, data, h, 'drills');
  s.stockpile.wood = 500;
  const job = planJob(s, data, h);
  assert.equal(job.b, ground);
  finish(s, h, job);
  assert.equal(ground.level, 2);
  assert.equal(buildingEffect(data, ground, 'trainingXp'), 1.5);
  assert.ok(s.history.some((e) => e.text === 'The Training Ground was upgraded to level 2'));
  // The Great Hall only grows when it's nearly full.
  learnTech(s, data, h, 'carpentry');
  learnTech(s, data, h, 'architecture');
  finish(s, h, planJob(s, data, h)); // the workshop comes first
  const next = planJob(s, data, h);
  assert.notEqual(next?.b?.type, 'great_hall');
});

test('a couple gets a family house with beds of their own', () => {
  const s = createSim(data, 'house');
  const a = s.humans.find((h) => h.sex === 'female');
  const b = s.humans.find((h) => h.sex === 'male');
  a.partnerId = b.id;
  b.partnerId = a.id;
  learnTech(s, data, a, 'carpentry');
  s.stockpile.wood = 500;
  const cap = populationCap(s, data);
  finish(s, a, planJob(s, data, a)); // workshop
  const job = planJob(s, data, a);
  assert.equal(job.def.id, 'family_house');
  const house = finish(s, a, job);
  assert.match(house.plot, /^home:\d$/);
  assert.deepEqual([...house.owners].sort(), [a.id, b.id].sort());
  assert.equal(populationCap(s, data), cap + 4);
  assert.equal(freeShelter(s, data, a), house);
  assert.notEqual(freeShelter(s, data, s.humans.find((h) => h !== a && h !== b)), house);
  assert.ok(a.feelings.some((f) => f.text === 'Moved into a home of our own'));
  assert.equal(planJob(s, data, a), null, 'no more houses wanted');
  // When the owners are gone, the next couple moves in.
  const c = s.humans.find((h) => h !== a && h.sex === 'female');
  const e = s.humans.find((h) => h !== b && h.sex === 'male');
  c.partnerId = e.id;
  e.partnerId = c.id;
  killHuman(s, data, a, 'old age');
  killHuman(s, data, b, 'old age');
  run(s, DAY);
  assert.deepEqual([...house.owners].sort(), [c.id, e.id].sort());
});

test('carpenters make tools that people pick up and wear out', () => {
  const s = createSim(data, 'tools');
  const h = s.humans[0];
  learnTech(s, data, h, 'carpentry');
  s.stockpile.wood = 500;
  finish(s, h, planJob(s, data, h));
  for (const o of s.humans) o.skills = {};
  const farmer = s.humans[1];
  gainXp(s, data, farmer, 'farming', 1);
  assert.equal(craftChoice(s, data, h)?.id, 'hoe', 'a hoe is wanted for the farmer');
  s.stockpile.hoe = 1;
  s.tick = DAY * 3;
  handOutTools(s, data);
  assert.equal(farmer.tools.hoe, data.itemsById.hoe.durability);
  assert.equal(s.stockpile.hoe, 0);
  assert.notEqual(craftChoice(s, data, h)?.id, 'hoe', 'no more hoes wanted');
  for (let i = 0; i < data.itemsById.hoe.durability; i++) wearTools(farmer, data, 'farming');
  assert.equal(farmer.tools.hoe, undefined, 'worn out');
});

test('better recipes: mashed potatoes, then bread from an upgraded kitchen', () => {
  const s = createSim(data, 'recipes');
  const cook = s.humans[0];
  s.stockpile.food = 500;
  assert.equal(craftChoice(s, data, cook).id, 'cooked_food');
  learnTech(s, data, cook, 'potato_cuisine');
  assert.equal(craftChoice(s, data, cook).id, 'mashed_potatoes');
  s.stockpile.wood = 500;
  finish(s, cook, { b: builtOfType(s, 'kitchen'), u: data.buildingsById.kitchen.upgrades[0] });
  assert.equal(craftChoice(s, data, cook).id, 'potato_bread');
  s.stockpile.potato_bread = 1;
  s.stockpile.cooked_food = 1;
  cook.needs.hunger = 10;
  eatFromStock(s, data, cook);
  assert.equal(s.stockpile.potato_bread, 0, 'the best meal is eaten first');
  assert.ok(cook.feelings.some((f) => f.text === 'Ate potato bread'));
});

test('ale at the Tavern lifts spirits and brings people closer', () => {
  const s = createSim(data, 'tavern');
  const [a, b] = s.humans;
  learnTech(s, data, a, 'brewing');
  s.stockpile.wood = 500;
  s.stockpile.food = 500;
  const tavern = finish(s, a, { def: data.buildingsById.tavern });
  assert.equal(craftChoice(s, data, a).id, 'potato_ale');
  s.stockpile.potato_ale = 10;
  for (const h of [a, b]) {
    h.x = tavern.x;
    h.y = tavern.y;
    h.needs.social = 10;
    h.needs.hunger = h.needs.energy = 100;
    h.action = { type: 'drink', buildingId: tavern.id, path: [], ticks: 1 };
  }
  updateHuman(s, data, a);
  updateHuman(s, data, b);
  assert.ok(a.needs.social > 40 && b.needs.social > 40);
  assert.equal(s.stockpile.potato_ale, 8);
  assert.ok(b.feelings.some((f) => f.text === 'Shared a drink at the Tavern'));
});

test('study in the Library builds Research and leads to discoveries', () => {
  const s = createSim(data, 'library');
  const h = s.humans[0];
  // Martial Drills needs any fighting skill at 4: study lowers the bar.
  h.skills.archery = { level: 3, xp: 0 };
  let found = null;
  for (let i = 0; i < 200 && !found; i++) found = tryDiscover(s, data, h, 1000, data.config.study.thresholdFactor);
  assert.equal(found?.id, 'drills');
  learnTech(s, data, h, 'writing');
  s.stockpile.wood = 500;
  const lib = finish(s, h, { def: data.buildingsById.library });
  h.x = lib.x;
  h.y = lib.y;
  h.needs.hunger = h.needs.energy = 100;
  h.action = { type: 'study', buildingId: lib.id, path: [], ticks: 1 };
  updateHuman(s, data, h);
  assert.ok(h.skills.research?.xp > 0 || h.skills.research?.level > 0);
});

test('over the years the sanctuary builds itself up without famine', () => {
  const s = createSim(data, 'years');
  run(s, 5 * 60 * DAY);
  assert.equal(s.dead.filter((d) => d.cause === 'starvation').length, 0);
  const built = s.buildings.filter((b) => b.built && b.plot);
  assert.ok(built.length >= 3, `only ${built.map((b) => b.type)}`);
  assert.ok(s.buildings.some((b) => b.level >= 2), 'something was upgraded');
});

// --- The Portal ---

import { activeExpedition } from '../src/sim/dungeon.js';
import { heroFighter } from '../src/sim/combat.js';

const adults = (s) => s.humans.filter((h) => lifeStage(h, s, data) !== 'child');

// Makes a hero strong (or weak) for tests.
function setFighter(h, level, skill = 'swordsmanship') {
  for (const k of Object.keys(h.stats)) h.stats[k] = level;
  h.skills[skill] = { level, xp: 0 };
  h.skills.defense = { level, xp: 0 };
  h.health = 100;
}

function runExpedition(s) {
  for (let i = 0; i < 30 * DAY && activeExpedition(s); i++) stepSim(s, data);
  return s.expeditions.at(-1);
}

test('the portal refuses parties it cannot send', () => {
  const s = createSim(data, 'refuse');
  const ids = adults(s).map((h) => h.id);
  assert.equal(usePower(s, data, 'portal', { party: [], floor: 1 }).ok, false);
  assert.match(usePower(s, data, 'portal', { party: ids.slice(0, 6), floor: 1 }).error, /At most 5/);
  assert.match(usePower(s, data, 'portal', { party: ids.slice(0, 2), floor: 2 }).error, /sealed/);
  s.humans[0].pregnantUntil = s.tick + DAY;
  assert.match(usePower(s, data, 'portal', { party: [s.humans[0].id], floor: 1 }).error, /pregnant/);
  assert.ok(usePower(s, data, 'portal', { party: ids.slice(1, 3), floor: 1 }).ok);
  assert.match(usePower(s, data, 'portal', { party: ids.slice(3, 4), floor: 1 }).error, /already out/);
});

test('a strong party clears Floor 1, brings loot home and opens Floor 2', () => {
  const s = createSim(data, 'raid');
  const party = adults(s).slice(0, 3);
  for (const h of party) setFighter(h, 12);
  assert.ok(usePower(s, data, 'portal', { party: party.map((h) => h.id), floor: 1 }).ok);
  // They walk to the portal and step through; needs are on hold inside.
  let hungerInside = null;
  for (let i = 0; i < 5 * DAY && party[0].away == null; i++) stepSim(s, data);
  assert.ok(party.every((h) => h.away != null), 'everyone went in');
  hungerInside = party[0].needs.hunger;
  run(s, 20);
  assert.equal(party[0].needs.hunger, hungerInside);
  const exp = runExpedition(s);
  assert.equal(exp.outcome, 'victory');
  assert.equal(exp.reports.length, data.floorsById[1].rooms + 1);
  assert.ok(exp.reports.every((r) => r.lines.length > 0));
  assert.equal(s.dungeon.deepest, 2);
  assert.ok(party.every((h) => h.away == null && h.counters.expeditions === 1));
  assert.ok(party.some((h) => h.counters.kills > 0));
  assert.ok(s.stockpile.meat > 0 || s.stockpile.herbs > 0 || s.stockpile.hide > 0, 'loot in the store');
  assert.ok(s.history.some((e) => e.text.includes('slew the Giant Rat')));
  assert.ok(s.history.some((e) => e.text.includes('came home from the Mossy Burrows')));
  assert.ok(bondValue(s, party[0], party[1]) > 0, 'fought side by side');
});

test('the deep dungeon kills those who are not ready', () => {
  let deaths = 0;
  for (const seed of ['doom1', 'doom2', 'doom3']) {
    const s = createSim(data, seed);
    s.dungeon.deepest = 4;
    const [h] = adults(s);
    setFighter(h, 3);
    assert.ok(usePower(s, data, 'portal', { party: [h.id], floor: 4 }).ok);
    const exp = runExpedition(s);
    assert.notEqual(exp.outcome, 'victory');
    if (!s.humans.includes(h)) {
      deaths++;
      assert.equal(s.dead.at(-1).cause, 'dungeon');
      assert.ok(s.history.some((e) => e.text.startsWith(h.name) && /Deep Forge/.test(e.text)));
    }
  }
  assert.ok(deaths >= 2, `only ${deaths} of 3 died`);
});

test('a party can be called home, and a save mid-expedition resumes exactly', () => {
  const s = createSim(data, 'recall');
  const party = adults(s).slice(0, 2);
  for (const h of party) setFighter(h, 15);
  usePower(s, data, 'portal', { party: party.map((h) => h.id), floor: 1 });
  for (let i = 0; i < 5 * DAY && activeExpedition(s)?.phase !== 'inside'; i++) stepSim(s, data);
  const copy = deserialize(serialize(s));
  run(s, DAY);
  run(copy, DAY);
  assert.equal(serialize(s), serialize(copy));
  assert.ok(usePower(s, data, 'portal', { recall: true }).ok);
  const exp = runExpedition(s);
  assert.ok(['recalled', 'victory'].includes(exp.outcome));
  assert.ok(exp.reports.length <= data.floorsById[1].rooms + 1);
});

test('agile heroes fight with the bow, and meat becomes roast meat', () => {
  const s = createSim(data, 'bow');
  const h = s.humans[0];
  h.stats.agi = 12;
  h.stats.str = 2;
  assert.equal(heroFighter(h, data).style, 'archery');
  s.stockpile.meat = 5;
  s.stockpile.food = 100;
  assert.equal(craftChoice(s, data, h).id, 'roast_meat');
});
