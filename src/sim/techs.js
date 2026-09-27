import { chance } from './rng.js';
import { logEvent } from './history.js';
import { skillLevel } from './skills.js';
import { tileNear } from './world.js';
import { builtNear } from './buildings.js';
import { focusValue, isInspired } from './status.js';
import { statFactor } from './stats.js';
import { feel } from './mood.js';

// Knowledge belongs to people, not the tribe: h.knows lists the techs a person
// knows. state.discoveries records what the tribe has ever found, and whether
// that knowledge has since been lost with the last person who held it.

export function knows(h, techId) {
  return h.knows.includes(techId);
}

export function anyoneKnows(state, techId) {
  return state.humans.some((h) => knows(h, techId));
}

export function canLearn(h, data, techId) {
  return !knows(h, techId) && data.techsById[techId].prerequisites.every((p) => knows(h, p));
}

export function learnTech(state, data, h, techId) {
  if (knows(h, techId)) return;
  const record = state.discoveries[techId];
  const isNew = !record || record.lost;
  h.knows.push(techId);
  if (!isNew) return;
  const name = data.techsById[techId].name;
  logEvent(state, record ? `${h.name} rediscovered ${name}` : `${h.name} discovered ${name}`);
  feel(state, data, h, 'discovered', `Discovered ${name}`);
  h.counters.discoveries = (h.counters.discoveries ?? 0) + 1;
  state.discoveries[techId] = { by: h.name, tick: state.tick, lost: false };
}

// Called when someone dies: anything only they knew is gone.
export function forgetOnDeath(state, data, h) {
  for (const techId of h.knows) {
    if (anyoneKnows(state, techId)) continue;
    const record = state.discoveries[techId];
    if (record) record.lost = true;
    logEvent(state, `The knowledge of ${data.techsById[techId].name} died with ${h.name}`);
  }
}

// Summed effect of the techs a person knows (e.g. teachingMultiplier).
export function techEffect(h, data, key) {
  let m = 1;
  for (const id of h.knows) m *= data.techsById[id].effects?.[key] ?? 1;
  return m;
}

// `f` scales thresholds down for inspired people (their dream shows the way).
const CONDITIONS = {
  tierMin: (c, h, state) => (state.settlement.tier ?? 1) >= c.tier,
  skillMin: (c, h, state, data, f) => skillLevel(h, c.skill) >= Math.floor(c.level * f),
  skillMinAny: (c, h, state, data, f) => c.skills.some((s) => skillLevel(h, s) >= Math.floor(c.level * f)),
  counterMin: (c, h, state, data, f) => (h.counters[c.counter] ?? 0) >= c.min * f,
  tribeCounterMin: (c, h, state, data, f) => (state.tribeCounters[c.counter] ?? 0) >= c.min * f,
  nearTile: (c, h, state) => tileNear(state.world, h.x, h.y, c.tile, c.radius),
  nearBuilding: (c, h, state, data) => builtNear(state, data, h.x, h.y, c.building, c.radius),
  nearFeature: (c, h, state) => state.world.resources.some(
    (r) => r[c.feature] && Math.abs(r.x - h.x) <= c.radius && Math.abs(r.y - h.y) <= c.radius,
  ),
};

// Every few ticks, each person rolls for each tech whose conditions they meet.
// Curious or clever people (per the tech's traitBonus) are likelier to notice,
// and the Inspire power makes it far likelier still.
export function updateDiscovery(state, data) {
  if (state.tick % data.config.discovery.checkEveryTicks !== 0) return;
  for (const h of state.humans) tryDiscover(state, data, h);
}

// One roll per tech for this person. `mult` scales the chance and `f` the
// thresholds (study in the Library passes both). Returns the tech found, if any.
export function tryDiscover(state, data, h, mult = 1, f = 1) {
  const inspire = data.powersById.inspire;
  const inspired = isInspired(h, state);
  if (inspired) f *= inspire.thresholdFactor;
  for (const tech of data.techs) {
    const d = tech.discovery;
    if (!d || !canLearn(h, data, tech.id)) continue;
    if (!d.conditions.every((c) => CONDITIONS[c.type](c, h, state, data, f))) continue;
    let p = d.baseChance * mult * (inspired ? inspire.chanceMultiplier : 1) * statFactor(h, data, 'int') * focusValue(state, data, 'discovery');
    for (const t of h.traits) p *= d.traitBonus?.[t] ?? 1;
    if (chance(state.rng, p)) {
      learnTech(state, data, h, tech.id);
      return tech;
    }
  }
  return null;
}

// During a friendly chat, a teacher may pass on one tech the student is ready
// for. Storytellers teach better.
export function teachTech(state, data, teacher, student, quality) {
  const tech = data.techs.find((t) => knows(teacher, t.id) && canLearn(student, data, t.id));
  if (!tech) return false;
  const p = data.config.discovery.teachTechChance * quality * techEffect(teacher, data, 'teachingMultiplier')
    * focusValue(state, data, 'teach');
  if (!chance(state.rng, p)) return false;
  learnTech(state, data, student, tech.id);
  return true;
}
