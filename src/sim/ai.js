import { next, randInt } from './rng.js';
import { bfs, buildPath } from './pathfinding.js';
import { tileIndex } from './world.js';
import { traitMod } from './traits.js';
import { gainXp, skillLevel, workTimeFactor } from './skills.js';
import { bondValue, isFamily, resolveChat } from './bonds.js';
import { lifeStage } from './lifecycle.js';
import { dateOf } from './time.js';
import { emotionEffect } from './emotions.js';
import { leaderWorkBonus } from './settlement.js';
import { focusValue } from './status.js';
import { feel } from './mood.js';
import {
  bestBuildingFor, buildingById, buildingEffect, buildingWith, builtOfType, freeShelter, inside, isWarm, roomSpot,
} from './buildings.js';
import {
  canStoreFood, carryCapacity, craftChoice, eatFromStock, finishCraft, foodInStock, foodReserveWanted, mealsInStock,
  stationFor, toolEffect, toolWorkFactor, wearTools,
} from './items.js';
import { addWork, openJobFor, planJob, startJob } from './construction.js';
import { tryDiscover } from './techs.js';
import { portalYard } from './dungeon.js';
import { changeBond } from './bonds.js';
import { appeal } from './appeal.js';
import { addFeeling } from './mood.js';
import { drive, rankDef } from './rank.js';

// Each human always has one action. An action runs over several ticks and sets
// `done` when finished; the human then scores its options and starts a new one.
// Life in the sanctuary: meals in the Dining Hall, beds in the Great Hall,
// training (or play) at the Training Ground, work in the grove and the field,
// and building up the sanctuary on its plots.

const INTERRUPTIBLE = new Set(['wander', 'idle', 'socialize', 'chat', 'pray', 'train', 'study', 'drink', 'recover', 'arcane']);
// Work in progress: only a critical hunger cuts it short, so a job already
// underway isn't abandoned lightly.
const WORK = new Set(['gather', 'harvest', 'deposit', 'sleep', 'goSleep', 'craft', 'build']);

// Called to the portal: everything else waits, except a meal when hungry.
const CALLED = new Set(['toPortal', 'atPortal']);
const EATING = new Set(['seekFood', 'eat']);

export function updateHuman(state, data, h) {
  if (h.punished && servePunishment(state, data, h)) return;
  const hungry = h.needs.hunger < data.config.needs.hunger.seekBelow;
  if (h.called != null && !CALLED.has(h.action.type) && !(hungry && EATING.has(h.action.type))) {
    if (!(hungry && canSearchFood(state, h) && START.seekFood(state, data, h))) answerCall(state, data, h);
  } else if (shouldRethink(state, data, h)) chooseAction(state, data, h);
  RUN[h.action.type](state, data, h);
}

// The convicted stand in the stocks by the stockpile, or sit in the Watch
// House cells, until their time is up; they're given bread and water.
function servePunishment(state, data, h) {
  const p = h.punished;
  if (state.tick >= p.until) {
    h.punished = null;
    h.action = { type: 'idle', ticks: 2 };
    return false;
  }
  if (h.action.type !== 'punished') {
    const cell = p.buildingId != null && buildingById(state, p.buildingId);
    const sp = data.sanctuary.stockpile;
    const route = cell ? toRoom(state, data, h, cell) : null;
    h.action = { type: 'punished', path: route?.path ?? pathTo(state, data, h, sp.x + 2, sp.y + 1) ?? [], spot: route?.spot };
  }
  const fed = data.config.crime.fedAbove;
  h.needs.hunger = Math.max(h.needs.hunger, fed);
  h.needs.energy = Math.max(h.needs.energy, fed);
  if (h.action.path.length) stepAlongPath(state, data, h);
  return true;
}

function answerCall(state, data, h) {
  const spot = roomSpot(state, portalYard(data), h);
  const path = pathTo(state, data, h, spot.x, spot.y);
  h.action = path ? { type: 'toPortal', spot, path } : { type: 'atPortal', spot };
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
  if (CALLED.has(a.type)) return h.needs.hunger < n.hunger.critical && canSearchFood(state, h);
  if (WORK.has(a.type)) return h.needs.hunger < n.hunger.critical && canSearchFood(state, h);
  return false;
}

// Utility scoring: the more urgent a need, the higher its action scores.
// Traits, emotion, the leader and the current Omen scale how keen someone is
// to work, train or roam. If the best option can't start, the next is tried.
function chooseAction(state, data, h) {
  const n = data.config.needs;
  const options = [];
  const stage = lifeStage(h, state, data);
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
  const infirmary = builtOfType(state, 'infirmary');
  // Eat first: resting while starving only makes it worse.
  if (infirmary && h.health < data.config.infirmary.seekBelow && h.needs.hunger >= n.hunger.seekBelow) {
    options.push({ type: 'recover', score: data.config.infirmary.score + (100 - h.health) * 0.5 });
  }
  const tavern = builtOfType(state, 'tavern');
  if (tavern && state.stockpile.potato_ale > 0 && h.needs.social < data.config.tavern.socialBelow && stage !== 'child') {
    options.push({ type: 'drink', score: (100 - h.needs.social) * 0.9 });
  }
  if (h.knows.includes('worship') && state.tick >= h.nextPrayer) {
    const p = data.config.prayer;
    // The devout pray out of love, the fearful to appease.
    const want = h.devotion + (h.fear ?? 0) * data.config.fear.prayPerFear;
    options.push({ type: 'pray', score: (p.scoreBase + want * p.scorePerDevotion) * focusValue(state, data, 'pray') });
  }
  const train = data.config.training;
  if (stage === 'child') {
    options.push({ type: 'train', score: (train.scoreBase + 4 + next(state.rng) * 8) * focusValue(state, data, 'train') });
    // With an Academy, children go to school.
    if (builtOfType(state, 'academy')) options.push({ type: 'study', score: data.config.study.schoolScore + next(state.rng) * 8 });
  } else if (h.carrying) {
    // Finish a haul that was interrupted (e.g. to eat) before anything else optional.
    options.push({ type: 'deposit', score: 40 });
  } else {
    // Ambition to rise in rank makes people keener to work, train and study.
    const keen = emotionEffect(h, data, 'work') * leaderWorkBonus(state, data) * drive(state, data, h)
      * (1 + (h.fear ?? 0) * data.config.fear.workPerFear)
      * (stage === 'elder' ? data.config.lifecycle.elderWorkWeight : 1);
    const work = traitMod(h, data, 'workWeight') * keen;
    // Those already good at a craft (e.g. the best cooks) are likelier to take it on.
    const craft = craftChoice(state, data, h);
    if (craft) {
      // Cooks feel the pull of an empty meal store, as farmers do an empty larder.
      const wanted = state.humans.length * data.config.food.mealsPerPerson;
      // Fighters waiting on gear, or an empty medicine chest, matter too.
      const urgency = craft.kind === 'meal' ? data.config.food.cookUrgency * (1 - mealsInStock(state, data) / wanted)
        : craft.tier || craft.kind === 'medicine' ? data.config.gearUrgency : 0;
      options.push({ type: 'craft', score: (14 + urgency + skillLevel(h, craft.skill) * 1.5 + next(state.rng) * 8) * work });
    }
    if (canSearchResource(state, h)) {
      // Farmers feel the pull of an empty store: bringing in the harvest comes first.
      const urgency = canStoreFood(h, data) ? data.config.food.harvestUrgency * foodShortage(state, data) : 0;
      options.push({ type: 'gather', score: (15 + urgency + next(state.rng) * 10) * work * focusValue(state, data, 'gather') });
    }
    if (openJobFor(state, data, h) || planJob(state, data, h)) {
      const score = (data.config.construction.workScore + next(state.rng) * 10) * work * focusValue(state, data, 'build');
      options.push({ type: 'build', score });
    }
    if (studyPlace(state, data, h)) {
      const st = data.config.study;
      const score = (st.scoreBase + next(state.rng) * 8) * traitMod(h, data, 'studyWeight') * keen
        * focusValue(state, data, 'discovery');
      options.push({ type: 'study', score });
    }
    if (h.knows.includes('arcana') && builtOfType(state, 'mage_tower')) {
      const ar = data.config.arcane;
      const score = (ar.scoreBase + next(state.rng) * 8) * traitMod(h, data, 'studyWeight') * keen * focusValue(state, data, 'train');
      options.push({ type: 'arcane', score });
    }
    if (h.knows.includes('fighting')) {
      const score = (train.scoreBase + next(state.rng) * 8) * traitMod(h, data, 'trainWeight') * keen * focusValue(state, data, 'train');
      options.push({ type: 'train', score });
    }
  }
  options.push({ type: 'wander', score: (10 + next(state.rng) * 10) * traitMod(h, data, 'wanderWeight') });
  options.sort((a, b) => b.score - a.score);
  for (const o of options) if (START[o.type](state, data, h)) return;
}

// Where someone may study: the Academy if their rank earns them a seat (any
// child may go to school), else the Library for those who can read.
function studyPlace(state, data, h) {
  const academy = builtOfType(state, 'academy');
  if (academy && (lifeStage(h, state, data) === 'child' || rankDef(state, data, h)?.academy)) return academy;
  return h.knows.includes('writing') ? builtOfType(state, 'library') : null;
}

function pathTo(state, data, h, x, y) {
  const { world } = state;
  const start = tileIndex(world, h.x, h.y);
  const goal = tileIndex(world, x, y);
  if (start === goal) return [];
  const { prev, goal: found } = bfs(world, data, start, { isGoal: (i) => i === goal });
  return found < 0 ? null : buildPath(prev, start, goal);
}

// Walks to a free spot inside a building. Returns { spot, path } or null.
function toRoom(state, data, h, b, beds = false) {
  const spot = roomSpot(state, b, h, beds);
  const path = pathTo(state, data, h, spot.x, spot.y);
  return path ? { spot, path } : null;
}

const isFood = (data, r) => r.amount > 0 && data.resourcesById[r.type].food;

const START = {
  // Hot meals are eaten at the Dining Hall. With none cooked, people eat raw
  // potatoes from the store or straight from the field, whichever is nearer.
  seekFood(state, data, h) {
    if (h.carrying?.type === 'food') {
      h.action = { type: 'eat', fromCarry: true, ticks: data.config.humans.eatTicks };
      return true;
    }
    const { world, stockpile } = state;
    const hall = buildingWith(state, data, 'dining');
    if (mealsInStock(state, data) > 0 && hall) {
      const route = toRoom(state, data, h, hall);
      if (route) {
        h.action = { type: 'seekFood', dine: true, buildingId: hall.id, ...route };
        return true;
      }
    }
    const food = new Map();
    for (const r of world.resources) if (isFood(data, r)) food.set(tileIndex(world, r.x, r.y), r);
    const start = tileIndex(world, h.x, h.y);
    const { reached, prev, dist } = bfs(world, data, start);
    const nearest = reached.find((i) => food.has(i));
    const stockTile = tileIndex(world, stockpile.x, stockpile.y);
    const stockDist = foodInStock(state, data) > 0 && prev[stockTile] !== -1 ? dist[stockTile] : Infinity;
    if (nearest == null && stockDist === Infinity) {
      h.nextFoodSearch = state.tick + data.config.humans.foodSearchCooldown;
      return false;
    }
    if (nearest == null || stockDist <= dist[nearest]) {
      h.action = { type: 'seekFood', stock: true, path: buildPath(prev, start, stockTile) };
    } else {
      h.action = { type: 'seekFood', targetId: food.get(nearest).id, path: buildPath(prev, start, nearest) };
    }
    return true;
  },

  // Everyone has a bed in the Great Hall (while there's room); otherwise they
  // sleep where they stand, and in winter remember the cold night.
  sleep(state, data, h) {
    const hall = freeShelter(state, data, h);
    const route = hall && toRoom(state, data, h, hall, true);
    if (route) {
      h.action = { type: 'goSleep', buildingId: hall.id, ...route };
      return true;
    }
    h.action = { type: 'sleep' };
    if (dateOf(state.tick, data.config.time).season === 'Winter' && !isWarm(state, data, h)) {
      h.counters.coldNights = (h.counters.coldNights ?? 0) + 1;
      feel(state, data, h, 'coldNight', 'Slept out in the cold');
    }
    return true;
  },

  wander(state, data, h) {
    const { world } = state;
    const start = tileIndex(world, h.x, h.y);
    const base = lifeStage(h, state, data) === 'child' ? data.config.lifecycle.childWanderRadius : data.config.humans.wanderRadius;
    const radius = Math.round(base * traitMod(h, data, 'wanderRadius'));
    const { reached, prev } = bfs(world, data, start, { maxDist: radius });
    const goal = reached[randInt(state.rng, 0, reached.length - 1)];
    const path = buildPath(prev, start, goal);
    h.action = path.length ? { type: 'wander', path } : idleAction(state);
    return true;
  },

  // Adults train at the Training Ground; children play there.
  train(state, data, h) {
    const ground = buildingWith(state, data, 'training');
    const route = ground && toRoom(state, data, h, ground);
    if (!route) return false;
    h.action = { type: 'train', ...route, ticks: data.config.training.ticks };
    return true;
  },

  // Picks the best reachable job, not just the nearest: people lean toward work
  // they're good at and toward whatever the stores are short of. Farmers bring
  // in potatoes while the food store is below its target.
  gather(state, data, h) {
    const { world } = state;
    const cfg = data.config.skills;
    const storeFood = canStoreFood(h, data) && foodInStock(state, data) < foodReserveWanted(state, data);
    const targets = new Map();
    for (const r of world.resources) {
      if (r.amount <= 0) continue;
      const def = data.resourcesById[r.type];
      if (def.tech && !h.knows.includes(def.tech)) continue;
      if ((def.material && materialNeed(state, data, def.material) > 0) || (storeFood && def.food)) {
        targets.set(tileIndex(world, r.x, r.y), r);
      }
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
      if (o === h || o.away != null || o.action.type === 'sleep' || o.action.type === 'chat') continue;
      const i = tileIndex(world, o.x, o.y);
      if (prev[i] === -1) continue;
      const spouse = h.partnerId === o.id || o.partnerId === h.id;
      // The single seek out those they fancy.
      const fancy = h.partnerId == null && !spouse ? appeal(state, data, h, o) * data.config.appeal.socializeWeight : 0;
      const score = bondValue(state, h, o) * 0.3 + (spouse ? 30 : 0) + (isFamily(h, o) ? 15 : 0) + fancy - dist[i];
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

  // The faithful pray at the holiest place there is (a Shrine, once built).
  pray(state, data, h) {
    const hall = bestBuildingFor(state, data, 'prayerFaith');
    const route = hall ? toRoom(state, data, h, hall) : null;
    h.action = { type: 'pray', path: route?.path ?? [], spot: route?.spot, buildingId: hall?.id, ticks: data.config.prayer.ticks };
    return true;
  },

  // Cooks at the Kitchen, carpenters at the workshop, brewers at the Tavern.
  craft(state, data, h) {
    const def = craftChoice(state, data, h);
    const station = def && stationFor(state, data, def);
    const route = station && toRoom(state, data, h, station);
    if (!route) return false;
    const ticks = Math.max(1, Math.round(def.craftTicks * workTimeFactor(h, data, def.skill)));
    h.action = { type: 'craft', itemId: def.id, ticks, ...route };
    return true;
  },

  // Joins work on a site or upgrade underway, or starts a new one.
  build(state, data, h) {
    let b = openJobFor(state, data, h);
    if (!b) {
      const job = planJob(state, data, h);
      if (!job) return false;
      b = startJob(state, data, h, job);
    }
    const route = toRoom(state, data, h, b);
    if (!route) return false;
    h.action = { type: 'build', buildingId: b.id, ticks: data.config.construction.ticks, ...route };
    return true;
  },

  study(state, data, h) {
    const lib = studyPlace(state, data, h);
    const route = lib && toRoom(state, data, h, lib);
    if (!route) return false;
    h.action = { type: 'study', buildingId: lib.id, ticks: data.config.study.ticks, ...route };
    return true;
  },

  // The wounded rest in an Infirmary bed until they're nearly whole.
  recover(state, data, h) {
    const inf = builtOfType(state, 'infirmary');
    const route = inf && toRoom(state, data, h, inf, true);
    if (!route) return false;
    h.action = { type: 'recover', buildingId: inf.id, ...route };
    return true;
  },

  arcane(state, data, h) {
    const tower = builtOfType(state, 'mage_tower');
    const route = tower && toRoom(state, data, h, tower);
    if (!route) return false;
    h.action = { type: 'arcane', buildingId: tower.id, ticks: data.config.arcane.ticks, ...route };
    return true;
  },

  drink(state, data, h) {
    const tavern = builtOfType(state, 'tavern');
    const route = tavern && toRoom(state, data, h, tavern);
    if (!route) return false;
    h.action = { type: 'drink', buildingId: tavern.id, ticks: data.config.tavern.ticks, ...route };
    return true;
  },
};

function foodShortage(state, data) {
  return Math.max(0, 1 - foodInStock(state, data) / foodReserveWanted(state, data));
}

function foodNeed(state, data) {
  return data.config.food.storeScarcityBonus * foodShortage(state, data) * focusValue(state, data, 'storeFood');
}

// A bonus that grows the further a material is below its target (scaled by
// population), and a penalty once there's plenty.
function materialNeed(state, data, material) {
  const g = data.config.gather;
  const target = (g.targetPerPerson[material] ?? 0) * state.humans.length;
  const have = state.stockpile[material] ?? 0;
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

// Picks which fighting skill a training session works on. People lean toward
// what suits their build (strong: sword, agile: bow, tough: defense) and what
// they're already good at, so fighters develop a style of their own.
function trainingSkill(state, data, h) {
  const skills = data.config.training.stats;
  const weights = skills.map((s) => (h.stats[data.skillsById[s].stat] + skillLevel(h, s) * 2) ** 2);
  let r = next(state.rng) * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < skills.length; i++) {
    if ((r -= weights[i]) < 0) return skills[i];
  }
  return skills[0];
}

const RUN = {
  seekFood(state, data, h) {
    const a = h.action;
    const target = a.stock || a.dine ? null : findResource(state, a.targetId);
    const gone = a.dine ? mealsInStock(state, data) <= 0 : a.stock ? foodInStock(state, data) <= 0 : !target || target.amount <= 0;
    if (gone) {
      a.done = true;
      return;
    }
    if (a.path.length) stepAlongPath(state, data, h);
    else h.action = { type: 'eat', dine: a.dine, buildingId: a.buildingId, spot: a.spot, stock: a.stock, targetId: a.targetId, ticks: data.config.humans.eatTicks };
  },

  // Eats one portion per few ticks, and keeps eating until full (or the food
  // runs out), so a walk to the field or the Dining Hall is worth it.
  eat(state, data, h) {
    const a = h.action;
    if (--a.ticks > 0) return;
    if (!eatPortion(state, data, h, a) || h.needs.hunger >= data.config.humans.eatUntil) {
      a.done = true;
      return;
    }
    a.ticks = data.config.humans.eatTicks;
  },

  goSleep(state, data, h) {
    const hall = buildingById(state, h.action.buildingId);
    if (!hall) {
      h.action = { type: 'sleep' };
      return;
    }
    if (h.action.path.length) stepAlongPath(state, data, h);
    else {
      h.action = { type: 'sleep', buildingId: hall.id, spot: h.action.spot };
      const where = buildingEffect(data, hall, 'home') ? 'Slept at home' : `Slept in the ${data.buildingsById[hall.type].name}`;
      feel(state, data, h, 'warmBed', where);
    }
  },

  sleep(state, data, h) {
    const e = data.config.needs.energy;
    const hall = h.action.buildingId != null && buildingById(state, h.action.buildingId);
    const bonus = hall ? buildingEffect(data, hall, 'sleepRestore') ?? 1 : 1;
    h.needs.energy = Math.min(100, h.needs.energy + e.sleepRestore * bonus);
    if (h.needs.energy >= e.wakeAt) h.action.done = true;
  },

  wander(state, data, h) {
    if (h.action.path.length) stepAlongPath(state, data, h);
    else h.action = idleAction(state);
  },

  // Training builds fighting skill (and so level and stats), and is tiring.
  // Children play instead: smaller gains, but they enjoy the company.
  train(state, data, h) {
    const a = h.action;
    if (a.path.length) {
      stepAlongPath(state, data, h);
      return;
    }
    h.needs.energy = Math.max(0, h.needs.energy - 0.15);
    if (--a.ticks > 0) return;
    a.done = true;
    const child = lifeStage(h, state, data) === 'child';
    const skill = trainingSkill(state, data, h);
    const ground = buildingWith(state, data, 'training');
    const boost = (ground ? buildingEffect(data, ground, 'trainingXp') : 1) * toolEffect(h, data, skill, 'trainingXp');
    const xp = data.skillsById[skill].xpPerAction * boost * (child ? data.config.training.childFactor : 1);
    gainXp(state, data, h, skill, xp);
    wearTools(h, data, skill);
    feel(state, data, h, 'goodTraining', child ? 'Played at the Training Ground' : 'A good training session');
  },

  gather(state, data, h) {
    const target = findResource(state, h.action.targetId);
    if (!target || target.amount <= 0) {
      h.action.done = true;
      return;
    }
    if (h.action.path.length) stepAlongPath(state, data, h);
    else h.action = { type: 'harvest', targetId: target.id, ticks: harvestTicks(h, data, data.resourcesById[target.type]) };
  },

  harvest(state, data, h) {
    if (--h.action.ticks > 0) return;
    const target = findResource(state, h.action.targetId);
    if (target && target.amount > 0) {
      const def = data.resourcesById[target.type];
      const yields = def.material ?? 'food';
      target.amount--;
      h.carrying ??= { type: yields, amount: 0 };
      h.carrying.amount += def.harvestYield ?? 1;
      gainXp(state, data, h, def.skill, data.skillsById[def.skill].xpPerAction);
      wearTools(h, data, def.skill);
      h.counters[`gather:${yields}`] = (h.counters[`gather:${yields}`] ?? 0) + 1;
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
      state.stockpile[h.carrying.type] = (state.stockpile[h.carrying.type] ?? 0) + h.carrying.amount;
      h.carrying = null;
    }
    h.action.done = true;
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

  // Building is steady work: skill speeds it up, and it teaches Building.
  build(state, data, h) {
    const a = h.action;
    const b = buildingById(state, a.buildingId);
    if (!b || (b.built && !b.upgrade)) {
      a.done = true;
      return;
    }
    if (a.path.length) {
      stepAlongPath(state, data, h);
      return;
    }
    h.needs.energy = Math.max(0, h.needs.energy - 0.1);
    gainXp(state, data, h, 'building', data.skillsById.building.xpPerAction);
    const finished = addWork(state, data, h, b, 1 / workTimeFactor(h, data, 'building'));
    if (finished || --a.ticks <= 0) a.done = true;
  },

  // Study builds Research and gives a much better shot at a discovery, with
  // the thresholds lowered (the books show the way).
  study(state, data, h) {
    const a = h.action;
    if (a.path.length) {
      stepAlongPath(state, data, h);
      return;
    }
    if (--a.ticks > 0) return;
    a.done = true;
    const st = data.config.study;
    const place = buildingById(state, a.buildingId);
    const boost = (place && buildingEffect(data, place, 'studyBoost')) ?? 1;
    if (lifeStage(h, state, data) === 'child') {
      // School: a little of everything, and a trade picked up young.
      const skill = data.skills[randInt(state.rng, 0, data.skills.length - 1)].id;
      gainXp(state, data, h, skill, data.skillsById[skill].xpPerAction * boost);
      return;
    }
    gainXp(state, data, h, 'research', data.skillsById.research.xpPerAction * boost);
    tryDiscover(state, data, h, st.discoveryBoost * boost * (1 + skillLevel(h, 'research') * 0.1), st.thresholdFactor);
  },

  recover(state, data, h) {
    const a = h.action;
    if (a.path.length) {
      stepAlongPath(state, data, h);
      return;
    }
    const inf = buildingById(state, a.buildingId);
    const rate = (inf && buildingEffect(data, inf, 'healRate')) ?? 1;
    h.health = Math.min(100, h.health + data.config.needs.health.regen * (rate - 1));
    if (h.health >= data.config.infirmary.leaveAt) a.done = true;
  },

  // Practice at the Mage Tower builds Magic.
  arcane(state, data, h) {
    const a = h.action;
    if (a.path.length) {
      stepAlongPath(state, data, h);
      return;
    }
    h.needs.energy = Math.max(0, h.needs.energy - 0.1);
    if (--a.ticks > 0) return;
    a.done = true;
    gainXp(state, data, h, 'magic', data.skillsById.magic.xpPerAction);
  },

  // A mug of ale in company: a big lift to social needs, and a bond with
  // whoever else is drinking.
  drink(state, data, h) {
    const a = h.action;
    if (a.path.length) {
      stepAlongPath(state, data, h);
      return;
    }
    if (--a.ticks > 0) return;
    a.done = true;
    if (!(state.stockpile.potato_ale > 0)) return;
    state.stockpile.potato_ale--;
    const ale = data.itemsById.potato_ale;
    h.needs.social = Math.min(100, h.needs.social + ale.social);
    const tavern = buildingById(state, a.buildingId);
    const company = state.humans.filter((o) => o !== h && o.action.type === 'drink' && tavern && inside(tavern, o.x, o.y));
    for (const o of company) changeBond(state, data, h, o, data.config.tavern.bondGain);
    if (company.length) feel(state, data, h, 'sharedDrink', 'Shared a drink at the Tavern');
    else addFeeling(state, data, h, `Drank ${ale.name.toLowerCase()}`, Math.round(ale.mood / 2), 1);
  },

  idle(state, data, h) {
    if (--h.action.ticks <= 0) h.action.done = true;
  },

  toPortal(state, data, h) {
    if (h.action.path.length) stepAlongPath(state, data, h);
    else h.action = { type: 'atPortal', spot: h.action.spot };
  },

  // Waiting for the rest of the party; updateDungeon takes it from here.
  atPortal() {},
  away() {},

  // Prayer turns devotion into Faith.
  pray(state, data, h) {
    const a = h.action;
    if (a.path.length) {
      stepAlongPath(state, data, h);
      return;
    }
    if (--a.ticks > 0) return;
    const p = data.config.prayer;
    const place = a.buildingId != null && buildingById(state, a.buildingId);
    const holy = place ? buildingEffect(data, place, 'prayerFaith') ?? 1 : 1;
    state.faith = Math.min(data.config.faith.max, state.faith + p.fieldFaith * holy * (0.5 + h.devotion / 100));
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

// One portion from wherever this meal is being eaten. False if nothing's left.
function eatPortion(state, data, h, a) {
  if (a.fromCarry) {
    if (h.carrying?.type !== 'food') return false;
    h.needs.hunger = Math.min(100, h.needs.hunger + data.config.food.rawValue);
    if (--h.carrying.amount <= 0) h.carrying = null;
    return true;
  }
  if (a.dine || a.stock) {
    const hall = a.dine && buildingById(state, a.buildingId);
    const scale = hall ? buildingEffect(data, hall, 'dineMood') ?? 1 : 1;
    if (!eatFromStock(state, data, h, scale)) return false;
    const company = hall && state.humans.some((o) => o !== h && o.action.type === 'eat' && inside(hall, o.x, o.y));
    if (company) {
      const [value, days] = data.config.feelings.dinedTogether;
      addFeeling(state, data, h, 'Shared a meal in the Dining Hall', Math.round(value * scale), days);
    }
    return true;
  }
  const target = findResource(state, a.targetId);
  if (!target || target.amount <= 0) return false;
  target.amount--;
  h.needs.hunger = Math.min(100, h.needs.hunger + data.resourcesById[target.type].food);
  return true;
}

function inRange(a, b, range) {
  return Math.abs(a.x - b.x) <= range && Math.abs(a.y - b.y) <= range;
}

// The other person stops to talk if they were only idling, wandering or
// training; if they're busy, they talk while they work.
function startChat(state, data, h, target) {
  const ticks = data.config.social.chatTicks;
  h.action = { type: 'chat', withId: target.id, ticks, initiator: true };
  if (['idle', 'wander', 'train'].includes(target.action.type)) {
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
