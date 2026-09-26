import { next, randInt } from './rng.js';
import { bfs, buildPath } from './pathfinding.js';
import { tileIndex } from './world.js';

// Each human always has one action. An action runs over several ticks and sets
// `done` when finished; the human then scores its options and starts a new one.

const INTERRUPTIBLE = new Set(['wander', 'idle']);

export function updateHuman(state, data, h) {
  if (shouldRethink(state, data, h)) chooseAction(state, data, h);
  RUN[h.action.type](state, data, h);
}

function canSearchFood(state, h) {
  return state.tick >= h.nextFoodSearch;
}

function shouldRethink(state, data, h) {
  const n = data.config.needs;
  const a = h.action;
  if (a.done) return true;
  const hungry = h.needs.hunger < n.hunger.seekBelow && canSearchFood(state, h);
  const tired = h.needs.energy < n.energy.sleepBelow;
  if (INTERRUPTIBLE.has(a.type)) return hungry || tired;
  if (a.type === 'sleep') return h.needs.hunger < n.hunger.critical && canSearchFood(state, h);
  return false;
}

// Utility scoring: the more urgent a need, the higher its action scores.
// Wandering is the low-scoring fallback. If the best option can't start
// (e.g. no reachable food), the next one is tried.
function chooseAction(state, data, h) {
  const n = data.config.needs;
  const options = [];
  if (h.needs.hunger < n.hunger.seekBelow && canSearchFood(state, h)) {
    const desperate = h.needs.hunger < n.hunger.critical ? 50 : 0;
    options.push({ type: 'seekFood', score: 100 - h.needs.hunger + desperate });
  }
  if (h.needs.energy < n.energy.sleepBelow) {
    options.push({ type: 'sleep', score: 100 - h.needs.energy });
  }
  options.push({ type: 'wander', score: 20 + next(state.rng) * 10 });
  options.sort((a, b) => b.score - a.score);
  for (const o of options) if (START[o.type](state, data, h)) return;
}

const START = {
  seekFood(state, data, h) {
    const { world } = state;
    const food = new Map();
    for (const r of world.resources) {
      if (r.amount > 0 && data.resourcesById[r.type].food) food.set(tileIndex(world, r.x, r.y), r);
    }
    const start = tileIndex(world, h.x, h.y);
    const { goal, prev } = bfs(world, data, start, { isGoal: (i) => food.has(i) });
    if (goal < 0) {
      // Nothing reachable: don't search again every tick.
      h.nextFoodSearch = state.tick + data.config.humans.foodSearchCooldown;
      return false;
    }
    h.action = { type: 'seekFood', targetId: food.get(goal).id, path: buildPath(prev, start, goal) };
    return true;
  },

  sleep(state, data, h) {
    h.action = { type: 'sleep' };
    return true;
  },

  wander(state, data, h) {
    const { world } = state;
    const start = tileIndex(world, h.x, h.y);
    const { reached, prev } = bfs(world, data, start, { maxDist: data.config.humans.wanderRadius });
    const goal = reached[randInt(state.rng, 0, reached.length - 1)];
    const path = buildPath(prev, start, goal);
    h.action = path.length ? { type: 'wander', path } : idleAction(state);
    return true;
  },
};

function idleAction(state) {
  return { type: 'idle', ticks: randInt(state.rng, 4, 16) };
}

const RUN = {
  seekFood(state, data, h) {
    const target = state.world.resources.find((r) => r.id === h.action.targetId);
    if (!target || target.amount <= 0) {
      h.action.done = true;
      return;
    }
    if (h.action.path.length) stepAlongPath(state, data, h);
    else h.action = { type: 'eat', targetId: target.id, ticks: data.config.humans.eatTicks };
  },

  eat(state, data, h) {
    if (--h.action.ticks > 0) return;
    const target = state.world.resources.find((r) => r.id === h.action.targetId);
    if (target && target.amount > 0) {
      target.amount--;
      h.needs.hunger = Math.min(100, h.needs.hunger + data.resourcesById[target.type].food);
    }
    h.action.done = true;
  },

  sleep(state, data, h) {
    const e = data.config.needs.energy;
    h.needs.energy = Math.min(100, h.needs.energy + e.sleepRestore);
    if (h.needs.energy >= e.wakeAt) h.action.done = true;
  },

  wander(state, data, h) {
    if (h.action.path.length) stepAlongPath(state, data, h);
    else h.action = idleAction(state);
  },

  idle(state, data, h) {
    if (--h.action.ticks <= 0) h.action.done = true;
  },
};

// Moves one tile every `moveTicks` ticks. prevX/prevY and stepTick let the
// renderer slide the sprite smoothly between the two tiles.
function stepAlongPath(state, data, h) {
  if (state.tick < h.nextMoveTick) return;
  const i = h.action.path.shift();
  h.prevX = h.x;
  h.prevY = h.y;
  h.x = i % state.world.width;
  h.y = Math.floor(i / state.world.width);
  h.stepTick = state.tick;
  h.nextMoveTick = state.tick + data.config.humans.moveTicks;
}
