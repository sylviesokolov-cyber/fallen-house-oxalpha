import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { prepareData } from '../src/sim/data.js';
import { createSim, stepSim } from '../src/sim/sim.js';
import { serialize, deserialize } from '../src/sim/save.js';

const load = (name) => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
const data = prepareData({ config: load('config'), tiles: load('tiles'), resources: load('resources'), names: load('names') });
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

test('sim code has no Phaser or unseeded randomness', () => {
  const dir = new URL('../src/sim/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    assert.ok(!/Math\.random|Phaser|document\.|window\.|localStorage/.test(src), f);
  }
});
