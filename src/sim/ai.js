import { chance, next, randInt } from './rng.js';
import { bfs, buildPath } from './pathfinding.js';
import { tileIndex } from './world.js';
import { traitMod } from './traits.js';
import { gainXp, skillLevel, workTimeFactor, yieldFactor } from './skills.js';
import { bondValue, isFamily, resolveChat } from './bonds.js';
import { lifeStage } from './lifecycle.js';
import { dateOf } from './time.js';
import { emotionEffect } from './emotions.js';
import { leaderWorkBonus } from './settlement.js';
import { focusValue } from './status.js';
import { feel } from './mood.js';
import {
  buildingById, freeShelter, isWarm, openSiteFor, placeSite, wantedBuilding, workOnSite,
} from './buildings.js';
import {
  canStoreFood, carryCapacity, craftChoice, eatFromStock, finishCraft, foodInStock, foodReserveWanted, toolWorkFactor, useTool,
} from './items.js';

// Each human always has one action. An action runs over several ticks and sets
// `done` when finished; the human then scores its options and starts a new one.

const INTERRUPTIBLE = new Set(['wander', 'idle', 'socialize', 'chat', 'pray']);
// Work in progress: only a critical hunger cuts it short, so a job already
// underway isn't abandoned lightly.
const WORK = new Set(['gather', 'harvest', 'deposit', 'sleep', 'goSleep', 'build', 'craft']);

export function updateHuman(state, data, h) {
  if (shouldRethink(state, data, h)) chooseAction(state, data, h);
  RUN[h.action.type](state, data, h);
}

function bump(h, counter, n = 1) {
  h.counters[counter] = (h.counters[counter] ?? 0) + n;
}

function canSearchFood(state, h) {
  return state.tick >= h.nextFoodSearch;
}

function canSearchResource(state, h) {
  return state.tick >= h.nextResourceSearch;
}

function shouldRethink(state, data, h) {
  const n = data.config.needs;
  const a = h.action;
  if (a.done) return true;
  const hungry = h.needs.hunger < n.hunger.seekBelow && canSearchFood(state, h);
  const tired = h.needs.energy < n.energy.sleepBelow;
  if (INTERRUPTIBLE.has(a.type)) return hungry || tired;
  if (WORK.has(a.type)) return h.needs.hunger < n.hunger.critical && canSearchFood(state, h);
  return false;
}

// Utility scoring: the more urgent a need, the higher its action scores.
// Traits scale how much someone wants to work or roam. Wandering is the
// low-scoring fallback. If the best option can't start (e.g. no reachable
// food), the next one is tried.
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
  if (h.needs.social < n.social.seekBelow) {
    const urge = emotionEffect(h, data, 'socialize') * focusValue(state, data, 'socialize');
    options.push({ type: 'socialize', score: (100 - h.needs.social) * 0.8 * urge });
  }
  if (h.knows.includes('worship') && state.tick >= h.nextPrayer) {
    const p = data.config.prayer;
    options.push({ type: 'pray', score: (p.scoreBase + h.devotion * p.scorePerDevotion) * focusValue(state, data, 'pray') });
  }
  const stage = lifeStage(h, state, data);
  if (h.carrying) {
    // Finish a haul that was interrupted (e.g. to eat) before anything else optional.
    options.push({ type: 'deposit', score: 40 });
  } else if (stage !== 'child') {
    // Keenness to work: traits, age, emotion, and a charismatic leader.
    const work = traitMod(h, data, 'workWeight') * (stage === 'elder' ? data.config.lifecycle.elderWorkWeight : 1)
      * emotionEffect(h, data, 'work') * leaderWorkBonus(state, data);
    if (openSiteFor(state, data, h) || wantedBuilding(state, data, h)) {
      const score = (data.config.building.workScore + next(state.rng) * 10) * work * focusValue(state, data, 'build');
      options.push({ type: 'build', score });
    }
    if (craftChoice(state, data, h)) options.push({ type: 'craft', score: (18 + next(state.rng) * 8) * work });
    if (canSearchResource(state, h)) {
      options.push({ type: 'gather', score: (15 + next(state.rng) * 10) * work * focusValue(state, data, 'gather') });
    }
  }
  options.push({ type: 'wander', score: (10 + next(state.rng) * 10) * traitMod(h, data, 'wanderWeight') });
  options.sort((a, b) => b.score - a.score);
  for (const o of options) if (START[o.type](state, data, h)) return;
}

function pathTo(state, data, h, x, y) {
  const { world } = state;
  const start = tileIndex(world, h.x, h.y);
  const goal = tileIndex(world, x, y);
  if (start === goal) return [];
  const { prev, goal: found } = bfs(world, data, start, { isGoal: (i) => i === goal });
  return found < 0 ? null : buildPath(prev, start, goal);
}

const isFood = (data, r) => r.amount > 0 && !r.burning && data.resourcesById[r.type].food;

const START = {
  // Goes to the nearest food: a bush or field, or the stockpile if it has food
  // (cooked meals make the stockpile worth a slightly longer walk).
  seekFood(state, data, h) {
    // Someone hauling food eats from their own load first.
    if (h.carrying?.type === 'food') {
      h.action = { type: 'eat', fromCarry: true, ticks: data.config.humans.eatTicks };
      return true;
    }
    const { world, stockpile } = state;
    const food = new Map();
    for (const r of world.resources) if (isFood(data, r)) food.set(tileIndex(world, r.x, r.y), r);
    const start = tileIndex(world, h.x, h.y);
    const { reached, prev, dist } = bfs(world, data, start);
    const nearest = reached.find((i) => food.has(i));
    const stockTile = tileIndex(world, stockpile.x, stockpile.y);
    const stockDist = foodInStock(state) > 0 && prev[stockTile] !== -1
      ? dist[stockTile] - (stockpile.cooked_food > 0 ? 4 : 0)
      : Infinity;
    if (nearest == null && stockDist === Infinity) {
      // Nothing reachable: don't search again every tick.
      h.nextFoodSearch = state.tick + data.config.humans.foodSearchCooldown;
      return false;
    }
    if (nearest == null || stockDist < dist[nearest]) {
      h.action = { type: 'seekFood', stock: true, path: buildPath(prev, start, stockTile) };
    } else {
      h.action = { type: 'seekFood', targetId: food.get(nearest).id, path: buildPath(prev, start, nearest) };
    }
    return true;
  },

  // Heads to a free bed in a shelter they know how to use; otherwise sleeps
  // where they stand (and, in winter, remembers the cold night).
  sleep(state, data, h) {
    const shelter = freeShelter(state, data, h);
    const path = shelter && pathTo(state, data, h, shelter.x, shelter.y);
    if (path) {
      h.action = { type: 'goSleep', buildingId: shelter.id, path };
      return true;
    }
    h.action = { type: 'sleep' };
    if (dateOf(state.tick, data.config.time).season === 'Winter' && !isWarm(state, data, h)) {
      bump(h, 'coldNights');
      feel(state, data, h, 'coldNight', 'Slept out in the cold');
    }
    return true;
  },

  // Curious and brave people go and look at a burning tree; everyone else
  // just roams nearby.
  wander(state, data, h) {
    const { world } = state;
    const w = data.config.weather;
    const fire = world.resources.find((r) => r.burning && Math.abs(r.x - h.x) <= w.watchRadius && Math.abs(r.y - h.y) <= w.watchRadius);
    const bold = h.traits.includes('curious') || h.traits.includes('brave');
    if (fire && chance(state.rng, bold ? w.curiousWatchChance : w.curiousWatchChance / 4)) {
      const path = pathTo(state, data, h, fire.x, fire.y);
      if (path?.length) {
        h.action = { type: 'wander', path };
        return true;
      }
    }
    const start = tileIndex(world, h.x, h.y);
    const base = lifeStage(h, state, data) === 'child' ? data.config.lifecycle.childWanderRadius : data.config.humans.wanderRadius;
    const radius = Math.round(base * traitMod(h, data, 'wanderRadius'));
    const { reached, prev } = bfs(world, data, start, { maxDist: radius });
    const goal = reached[randInt(state.rng, 0, reached.length - 1)];
    const path = buildPath(prev, start, goal);
    h.action = path.length ? { type: 'wander', path } : idleAction(state);
    return true;
  },

  // Picks the best reachable material, not just the nearest: people lean toward
  // work they're already good at (so specialists emerge) and toward whatever
  // the stockpile is short of. People with a basket also gather food for
  // the stockpile while the tribe's reserve is low.
  gather(state, data, h) {
    const { world } = state;
    const cfg = data.config.skills;
    const storeFood = canStoreFood(h, data) && foodInStock(state) < foodReserveWanted(state, data);
    const targets = new Map();
    for (const r of world.resources) {
      if (r.amount <= 0 || r.burning) continue;
      const def = data.resourcesById[r.type];
      if (def.material || (storeFood && def.food)) targets.set(tileIndex(world, r.x, r.y), r);
    }
    const start = tileIndex(world, h.x, h.y);
    const { reached, prev, dist } = bfs(world, data, start);
    let best = -1;
    let bestScore = -Infinity;
    for (const i of reached) {
      const r = targets.get(i);
      if (!r) continue;
      const def = data.resourcesById[r.type];
      const bonus = def.food ? foodNeed(state, data) : materialNeed(state, data, def.material);
      const score = skillLevel(h, def.skill) * cfg.gatherSkillPreference + bonus - dist[i];
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best < 0) {
      h.nextResourceSearch = state.tick + data.config.humans.resourceSearchCooldown;
      return false;
    }
    h.action = { type: 'gather', targetId: targets.get(best).id, path: buildPath(prev, start, best) };
    return true;
  },

  // Seeks out someone to talk to, preferring a partner, family and friends
  // over strangers, and nearby people over distant ones.
  socialize(state, data, h) {
    const { world } = state;
    const start = tileIndex(world, h.x, h.y);
    const { dist, prev } = bfs(world, data, start);
    let best = null;
    let bestScore = -Infinity;
    for (const o of state.humans) {
      if (o === h || o.action.type === 'sleep' || o.action.type === 'chat') continue;
      const i = tileIndex(world, o.x, o.y);
      if (prev[i] === -1) continue;
      const score = bondValue(state, h, o) * 0.3 + (h.partnerId === o.id ? 30 : 0) + (isFamily(h, o) ? 15 : 0) - dist[i];
      if (score > bestScore) {
        bestScore = score;
        best = o;
      }
    }
    if (!best) return false;
    const goal = tileIndex(world, best.x, best.y);
    h.action = { type: 'socialize', targetId: best.id, retries: data.config.social.socializeRetries, path: buildPath(prev, start, goal) };
    return true;
  },

  deposit(state, data, h) {
    const path = pathTo(state, data, h, state.stockpile.x, state.stockpile.y);
    if (!path) return false;
    h.action = { type: 'deposit', path };
    return true;
  },

  // Joins an open construction site, or starts a new one the tribe needs.
  build(state, data, h) {
    let site = openSiteFor(state, data, h);
    if (!site) {
      const def = wantedBuilding(state, data, h);
      site = def && placeSite(state, data, def);
    }
    const path = site && pathTo(state, data, h, site.x, site.y);
    if (!path) return false;
    h.action = { type: 'build', siteId: site.id, path };
    return true;
  },

  // Prays at the shrine if there is one to reach, otherwise where they stand.
  pray(state, data, h) {
    const shrine = state.buildings.find((b) => b.built && data.buildingsById[b.type].effects.worship);
    const path = shrine ? pathTo(state, data, h, shrine.x, shrine.y) : null;
    h.action = { type: 'pray', atShrine: !!path, path: path ?? [], ticks: data.config.prayer.ticks };
    return true;
  },

  // Makes a tool or good at its station (a campfire) or at the stockpile.
  craft(state, data, h) {
    const def = craftChoice(state, data, h);
    if (!def) return false;
    const station = def.station && state.buildings.find((b) => b.built && b.type === def.station);
    const where = station ?? state.stockpile;
    const path = pathTo(state, data, h, where.x, where.y);
    if (!path) return false;
    const ticks = Math.max(1, Math.round(def.craftTicks * workTimeFactor(h, data, def.skill)));
    h.action = { type: 'craft', itemId: def.id, ticks, path };
    return true;
  },
};

// Storing food matters more the emptier the store is.
function foodNeed(state, data) {
  const short = 1 - foodInStock(state) / foodReserveWanted(state, data);
  return data.config.food.storeScarcityBonus * short * focusValue(state, data, 'storeFood');
}

// How much the tribe wants more of a material: a bonus that grows the further
// the stockpile is below its target (scaled by population), and a penalty once
// there's plenty, so people move on to whatever is actually short.
function materialNeed(state, data, material) {
  const g = data.config.gather;
  const target = g.targetPerPerson[material] * state.humans.length;
  const have = state.stockpile[material];
  return have < target ? g.shortageBonus * (1 - have / target) : -g.surplusPenalty;
}

function idleAction(state) {
  return { type: 'idle', ticks: randInt(state.rng, 4, 16) };
}

function findResource(state, id) {
  return state.world.resources.find((r) => r.id === id);
}

function harvestTicks(h, data, def) {
  const factor = workTimeFactor(h, data, def.skill) * toolWorkFactor(h, data, def.skill);
  return Math.max(1, Math.round(data.config.humans.gatherTicks * factor));
}

const RUN = {
  seekFood(state, data, h) {
    const a = h.action;
    const target = a.stock ? null : findResource(state, a.targetId);
    if (a.stock ? foodInStock(state) <= 0 : !target || target.amount <= 0) {
      a.done = true;
      return;
    }
    if (a.path.length) stepAlongPath(state, data, h);
    else h.action = { type: 'eat', stock: a.stock, targetId: a.targetId, ticks: data.config.humans.eatTicks };
  },

  eat(state, data, h) {
    if (--h.action.ticks > 0) return;
    h.action.done = true;
    if (h.action.fromCarry && h.carrying?.type === 'food') {
      h.needs.hunger = Math.min(100, h.needs.hunger + data.config.food.rawValue);
      if (--h.carrying.amount <= 0) h.carrying = null;
      return;
    }
    if (h.action.stock) {
      eatFromStock(state, data, h);
      return;
    }
    const target = findResource(state, h.action.targetId);
    if (target && target.amount > 0) {
      const def = data.resourcesById[target.type];
      target.amount--;
      h.needs.hunger = Math.min(100, h.needs.hunger + def.food * yieldFactor(h, data, def.skill));
      gainXp(state, data, h, def.skill, data.skillsById[def.skill].xpPerAction);
      bump(h, `eat:${target.type}`);
    }
  },

  goSleep(state, data, h) {
    const shelter = buildingById(state, h.action.buildingId);
    if (!shelter) {
      h.action = { type: 'sleep' };
      return;
    }
    if (h.action.path.length) stepAlongPath(state, data, h);
    else {
      h.action = { type: 'sleep', buildingId: shelter.id };
      feel(state, data, h, 'warmBed', `Slept in a ${data.buildingsById[shelter.type].name.toLowerCase()}`);
    }
  },

  sleep(state, data, h) {
    const e = data.config.needs.energy;
    const shelter = h.action.buildingId != null && buildingById(state, h.action.buildingId);
    const bonus = shelter ? data.buildingsById[shelter.type].effects.sleepRestore ?? 1 : 1;
    h.needs.energy = Math.min(100, h.needs.energy + e.sleepRestore * bonus);
    if (h.needs.energy >= e.wakeAt) h.action.done = true;
  },

  wander(state, data, h) {
    if (h.action.path.length) stepAlongPath(state, data, h);
    else h.action = idleAction(state);
  },

  gather(state, data, h) {
    const target = findResource(state, h.action.targetId);
    if (!target || target.amount <= 0 || target.burning) {
      h.action.done = true;
      return;
    }
    if (h.action.path.length) stepAlongPath(state, data, h);
    else h.action = { type: 'harvest', targetId: target.id, ticks: harvestTicks(h, data, data.resourcesById[target.type]) };
  },

  harvest(state, data, h) {
    if (--h.action.ticks > 0) return;
    const target = findResource(state, h.action.targetId);
    if (target && target.amount > 0 && !target.burning) {
      const def = data.resourcesById[target.type];
      const yields = def.material ?? 'food';
      target.amount--;
      h.carrying ??= { type: yields, amount: 0 };
      h.carrying.amount++;
      gainXp(state, data, h, def.skill, data.skillsById[def.skill].xpPerAction);
      bump(h, `gather:${yields}`);
      if (def.skill === 'woodcutting') useTool(h, 'stone_axe');
      if (target.amount > 0 && h.carrying.amount < carryCapacity(h, data)) {
        h.action.ticks = harvestTicks(h, data, def);
        return;
      }
    }
    if (!h.carrying || !START.deposit(state, data, h)) h.action.done = true;
  },

  deposit(state, data, h) {
    if (h.action.path.length) {
      stepAlongPath(state, data, h);
      return;
    }
    if (h.carrying) {
      state.stockpile[h.carrying.type] += h.carrying.amount;
      h.carrying = null;
      useTool(h, 'basket');
    }
    h.action.done = true;
  },

  build(state, data, h) {
    const site = buildingById(state, h.action.siteId);
    if (!site || site.built) {
      h.action.done = true;
      return;
    }
    if (h.action.path.length) stepAlongPath(state, data, h);
    else if (workOnSite(state, data, h, site)) h.action.done = true;
  },

  craft(state, data, h) {
    const a = h.action;
    if (a.path.length) {
      stepAlongPath(state, data, h);
      return;
    }
    if (--a.ticks > 0) return;
    finishCraft(state, data, h, data.itemsById[a.itemId]);
    a.done = true;
  },

  idle(state, data, h) {
    if (--h.action.ticks <= 0) h.action.done = true;
  },

  // Prayer turns devotion into Faith, far more of it at a shrine.
  pray(state, data, h) {
    const a = h.action;
    if (a.path.length) {
      stepAlongPath(state, data, h);
      return;
    }
    if (--a.ticks > 0) return;
    const p = data.config.prayer;
    const gain = (a.atShrine ? p.shrineFaith : p.fieldFaith) * (0.5 + h.devotion / 100);
    state.faith = Math.min(data.config.faith.max, state.faith + gain);
    h.devotion = Math.min(100, h.devotion + data.config.devotion.prayerGain * focusValue(state, data, 'devotion'));
    h.nextPrayer = state.tick + p.intervalDays * data.config.time.ticksPerDay;
    a.done = true;
  },

  // Walks toward the chosen person. People move, so on arrival the target may
  // have wandered off: re-path a couple of times before giving up.
  socialize(state, data, h) {
    const a = h.action;
    const target = state.humans.find((o) => o.id === a.targetId);
    if (!target || target.action.type === 'sleep') {
      a.done = true;
      return;
    }
    const range = data.config.social.chatRange;
    if (inRange(h, target, range)) {
      startChat(state, data, h, target);
      return;
    }
    if (a.path.length) {
      stepAlongPath(state, data, h);
      return;
    }
    if (a.retries-- <= 0) {
      a.done = true;
      return;
    }
    const path = pathTo(state, data, h, target.x, target.y);
    if (!path) a.done = true;
    else a.path = path;
  },

  // Only the person who started the conversation resolves it, so each chat
  // counts once even though both people are in a 'chat' action.
  chat(state, data, h) {
    if (--h.action.ticks > 0) return;
    const other = state.humans.find((o) => o.id === h.action.withId);
    if (h.action.initiator && other && inRange(h, other, data.config.social.chatRange + 1)) {
      resolveChat(state, data, h, other, (p) => lifeStage(p, state, data) !== 'child');
    }
    h.action.done = true;
  },
};

function inRange(a, b, range) {
  return Math.abs(a.x - b.x) <= range && Math.abs(a.y - b.y) <= range;
}

// The other person stops to talk if they were only idling or wandering;
// if they're busy, they talk while they work.
function startChat(state, data, h, target) {
  const ticks = data.config.social.chatTicks;
  h.action = { type: 'chat', withId: target.id, ticks, initiator: true };
  if (target.action.type === 'idle' || target.action.type === 'wander') {
    target.action = { type: 'chat', withId: h.id, ticks, initiator: false };
  }
}

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
  const child = lifeStage(h, state, data) === 'child';
  h.stepTicks = child ? data.config.lifecycle.childMoveTicks : data.config.humans.moveTicks;
  h.nextMoveTick = state.tick + h.stepTicks;
}
