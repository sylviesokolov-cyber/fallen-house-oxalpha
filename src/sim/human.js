import { chance, pick, randInt } from './rng.js';
import { bfs } from './pathfinding.js';
import { tileIndex } from './world.js';
import { ageInYears, dayIndexOf, daysPerYear } from './time.js';
import { logEvent } from './history.js';

function uniqueName(state, data, sex) {
  const used = new Set(state.humans.map((h) => h.name));
  for (let tries = 0; tries < 10; tries++) {
    const name = pick(state.rng, data.names[sex]);
    if (!used.has(name)) return name;
  }
  return pick(state.rng, data.names[sex]);
}

export function createHuman(state, data, x, y) {
  const { rng } = state;
  const cfg = data.config.humans;
  const sex = chance(rng, 0.5) ? 'female' : 'male';
  const age = randInt(rng, cfg.startAgeMin, cfg.startAgeMax);
  const yearLen = daysPerYear(data.config.time);
  return {
    id: state.nextId++,
    name: uniqueName(state, data, sex),
    sex,
    birthDay: dayIndexOf(state.tick, data.config.time) - age * yearLen - randInt(rng, 0, yearLen - 1),
    x,
    y,
    prevX: x,
    prevY: y,
    stepTick: 0,
    nextMoveTick: 0,
    nextFoodSearch: 0,
    needs: { hunger: randInt(rng, 55, 100), energy: randInt(rng, 50, 100) },
    health: 100,
    action: { type: 'idle', ticks: randInt(rng, 1, 8) },
  };
}

// Finds the grass tile closest to the map center, then places humans on
// random walkable tiles within a few steps of it.
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

export function killHuman(state, data, h, cause) {
  const age = humanAge(h, state, data);
  state.humans = state.humans.filter((o) => o.id !== h.id);
  state.dead.push({ id: h.id, name: h.name, sex: h.sex, birthDay: h.birthDay, deathTick: state.tick, cause });
  const text = cause === 'starvation' ? `${h.name} starved to death, aged ${age}` : `${h.name} died (${cause}), aged ${age}`;
  logEvent(state, text);
}
