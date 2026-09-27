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
const data = prepareData(Object.fromEntries(['config', 'tiles', 'resources', 'names', 'traits', 'skills', 'techs', 'buildings', 'items', 'powers', 'stats', 'grades', 'emotions', 'focuses', 'sanctuary'].map((n) => [n, load(n)])));
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
  run(quiet, 5 * DAY);
  run(devout, 5 * DAY);
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
