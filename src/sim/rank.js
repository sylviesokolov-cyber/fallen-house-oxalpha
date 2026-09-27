import { chance } from './rng.js';
import { logEvent } from './history.js';
import { addFeeling } from './mood.js';
import { lifeStage } from './lifecycle.js';
import { bondValue } from './bonds.js';

// Standing and rank. Everyone's standing is worked out from what they've
// made of themselves: their level and skills, their deeds (expeditions,
// bosses slain, discoveries), plus renown gained or lost along the way (a
// conviction costs a lot). Standing sets a rank from data/ranks.json, and
// rank brings perks: better meals, a seat at the Academy, market days, first
// claim on a new home. Ambitious people push harder when others rise past
// them, so a promotion spurs their friends and kin to work for their own.

export function standingOf(h, data) {
  const r = data.config.rank;
  const skills = Object.values(h.skills ?? {}).reduce((s, k) => s + k.level, 0);
  const c = h.counters ?? {};
  return Math.round(h.level * r.perLevel + skills * r.perSkillLevel + (c.expeditions ?? 0) * r.perExpedition
    + (c.bossKills ?? 0) * r.perBoss + (c.discoveries ?? 0) * r.perDiscovery + (h.renown ?? 0));
}

// Index into data.ranks. Children have none (-1); the convicted are outcasts
// until their sentence of shame runs out.
export function rankIndex(state, data, h) {
  if (lifeStage(h, state, data) === 'child') return -1;
  if (h.outcastUntil != null && state.tick < h.outcastUntil) return 0;
  const s = standingOf(h, data);
  let i = 1;
  for (let k = 1; k < data.ranks.length; k++) if (s >= data.ranks[k].min) i = k;
  return i;
}

export const rankDef = (state, data, h) => data.ranks[rankIndex(state, data, h)] ?? null;

// How hard someone pushes to better themselves: ambition, more so while
// spurred on by a rival's rise, and less once they're at the top.
export function drive(state, data, h) {
  const r = data.config.rank;
  const i = rankIndex(state, data, h);
  if (i < 0) return 1;
  const top = i >= data.ranks.length - 1 ? 0.3 : 1;
  const spur = h.spurUntil != null && state.tick < h.spurUntil ? r.spurDrive : 1;
  return 1 + (h.ambition ?? 0.5) * r.driveWeight * spur * top;
}

// Once a day: promotions and demotions, with the feelings they bring, and
// market days for those whose rank lets them buy a little luxury.
export function updateRanks(state, data) {
  if (state.tick % data.config.time.ticksPerDay !== 0) return;
  const r = data.config.rank;
  const m = data.config.mood;
  const market = state.buildings.some((b) => b.built && b.type === 'market');
  for (const h of state.humans) {
    const i = rankIndex(state, data, h);
    if (market && data.ranks[i]?.market && h.away == null && chance(state.rng, r.marketChance)) {
      addFeeling(state, data, h, 'Bought something nice at the market', r.marketMood, r.marketDays);
    }
    const was = h.rank ?? i;
    h.rank = i;
    if (i === was || i < 0 || was < 0) continue;
    const name = data.ranks[i].name;
    if (i > was) {
      logEvent(state, `${h.name} rose to be ${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${name}`);
      addFeeling(state, data, h, `Rose to ${name}`, m.joyValue, m.joyDays);
      // Those close to them who are left behind feel it, and the ambitious
      // among them are spurred on.
      for (const o of state.humans) {
        if (o === h || (o.rank ?? -1) < 0 || o.rank >= i || bondValue(state, o, h) < r.envyBondAt) continue;
        if ((o.ambition ?? 0.5) >= r.envyAmbition) {
          o.spurUntil = state.tick + r.spurDays * data.config.time.ticksPerDay;
          addFeeling(state, data, o, `Envies ${h.name}'s rise`, r.envyMood, r.spurDays);
        }
      }
    } else if (i > 0) {
      logEvent(state, `${h.name} fell to ${name}`);
      addFeeling(state, data, h, `Fell to ${name}`, -m.joyValue, m.joyDays);
      h.spurUntil = state.tick + r.spurDays * data.config.time.ticksPerDay;
    }
  }
}

// Ambition at birth: partly character, partly the family's.
export function rollAmbition(rand, traits, parents = []) {
  let a = 0.2 + rand * 0.6;
  if (traits.includes('hardworking')) a += 0.2;
  if (traits.includes('lazy')) a -= 0.25;
  if (traits.includes('brave')) a += 0.1;
  if (parents.length) a = a * 0.7 + (parents.reduce((s, p) => s + (p.ambition ?? 0.5), 0) / parents.length) * 0.3;
  return Math.max(0, Math.min(1, Math.round(a * 100) / 100));
}

// Children of standing start with some of their parents' renown.
export function birthRenown(data, parents) {
  const best = Math.max(0, ...parents.map((p) => standingOf(p, data)));
  return Math.round(best * data.config.rank.inheritShare);
}
