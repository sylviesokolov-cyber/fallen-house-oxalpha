import { chance, randInt, next } from './rng.js';
import { logEvent } from './history.js';
import { dateOf } from './time.js';
import { feel } from './mood.js';
import { changeBond } from './bonds.js';
import { gainXp } from './skills.js';
import { lifeStage } from './lifecycle.js';
import { populationCap } from './settlement.js';
import { builtOfType } from './buildings.js';
import { combatPower, fight, heroFighter, monsterFighters } from './combat.js';
import { portalYard, listNames } from './dungeon.js';
import { createHuman, freshHouse, killHuman } from './human.js';

// Things that happen to the sanctuary, from data/events.json, rolled once a
// day: monsters bursting out of the portal, a harvest festival, a sickness,
// a lost stranger wandering in. Each has its own chance and conditions.

const byId = (data, id) => data.events.find((e) => e.id === id);

export function updateEvents(state, data) {
  if (state.tick % data.config.time.ticksPerDay !== 0) return;
  updateSickness(state, data);
  const date = dateOf(state.tick, data.config.time);
  for (const ev of data.events) {
    if (date.year < (ev.minYear ?? 0) || (ev.season && ev.season !== date.season)) continue;
    if (ev.oncePerYear && state.eventYears?.[ev.id] === date.year) continue;
    if (!chance(state.rng, ev.chancePerDay)) continue;
    if (RUN[ev.id](state, data, ev) && ev.oncePerYear) (state.eventYears ??= {})[ev.id] = date.year;
  }
}

const RUN = {
  // Monsters from the floors already opened break into the sanctuary. The
  // strongest on hand fight them off; a battle report is kept like an
  // expedition's. Nobody bleeds out at home, but a big blow still kills.
  raid(state, data, ev) {
    if (state.dungeon.deepest < ev.minDeepest) return false;
    const floor = data.floorsById[Math.max(1, state.dungeon.deepest - 1)];
    const n = randInt(state.rng, floor.group[0], floor.group[1]) + ev.extraMonsters;
    const ids = Array.from({ length: n }, () => {
      const total = floor.monsters.reduce((s, m) => s + m.weight, 0);
      let r = next(state.rng) * total;
      return floor.monsters.find((m) => (r -= m.weight) < 0)?.id ?? floor.monsters[0].id;
    });
    const defenders = state.humans
      .filter((h) => h.away == null && lifeStage(h, state, data) !== 'child' && h.health > 40)
      .sort((a, b) => combatPower(b, data) - combatPower(a, data))
      .slice(0, ev.defenders);
    const monsters = monsterFighters(data, ids);
    const heroes = defenders.map((h) => heroFighter(h, data));
    const lines = [];
    const { won } = heroes.length ? fight(state, data, heroes, monsters, lines) : { won: false };
    for (const f of heroes) {
      const h = state.humans.find((o) => o.id === f.id);
      h.health = f.dead ? 0 : Math.max(f.down ? 5 : 1, (f.hp / f.maxHp) * 100);
      gainXp(state, data, h, f.style, f.attacks * data.dungeon.xpPerAttack);
      h.counters.kills = (h.counters.kills ?? 0) + f.kills.length;
    }
    const names = listNames(defenders.map((h) => h.name));
    const what = listNames([...new Set(monsters.map((m) => data.monstersById[m.id].name))].map((m) => `${m}s`));
    if (won) {
      logEvent(state, `${what} burst out of the portal! ${names} drove them back`);
      for (const h of defenders) feel(state, data, h, 'dungeonVictory', 'Defended the sanctuary');
    } else {
      const lost = Math.floor(state.stockpile.food * 0.25);
      state.stockpile.food -= lost;
      logEvent(state, `${what} burst out of the portal and ransacked the stores${defenders.length ? ` before ${names} could stop them` : ''}`);
    }
    for (const f of heroes.filter((x) => x.dead)) {
      killHuman(state, data, state.humans.find((o) => o.id === f.id), 'raid', `was killed by a ${f.killedBy} defending the sanctuary`);
    }
    state.expeditions.push({
      id: state.dungeon.nextId++, floor: floor.id, raid: true, members: defenders.map((h) => h.id), phase: 'done',
      reports: [{ title: `Raid: ${monsters.map((m) => m.name).join(', ')}`, lines: lines.slice(0, data.dungeon.maxReportLines), result: won ? 'repelled' : 'overrun' }],
      loot: {}, outcome: won ? 'repelled' : 'overrun', endTick: state.tick,
    });
    return true;
  },

  // An autumn feast when the stores are full: everyone's spirits lift and
  // the whole sanctuary grows closer.
  festival(state, data, ev) {
    if (state.stockpile.food < state.humans.length * ev.foodPerPerson) return false;
    state.stockpile.food -= state.humans.length;
    const here = state.humans.filter((h) => h.away == null);
    for (const h of here) h.feelings.push({ text: 'Harvest festival', value: ev.mood, until: state.tick + ev.days * data.config.time.ticksPerDay });
    for (let i = 0; i < here.length; i++) for (let j = i + 1; j < here.length; j++) changeBond(state, data, here[i], here[j], ev.bond);
    logEvent(state, `The people of ${state.settlement.name} held a harvest festival`);
    return true;
  },

  plague(state, data, ev) {
    const pool = state.humans.filter((h) => h.away == null && !h.sick);
    const n = Math.min(pool.length, randInt(state.rng, ev.victims[0], ev.victims[1]));
    if (!n) return false;
    const sick = [];
    for (let k = 0; k < n; k++) {
      const h = pool.splice(randInt(state.rng, 0, pool.length - 1), 1)[0];
      h.sick = state.tick + ev.sickDays * data.config.time.ticksPerDay;
      h.health = Math.min(h.health, ev.startHealth);
      sick.push(h);
    }
    logEvent(state, `A sickness struck ${listNames(sick.map((h) => h.name))}`);
    return true;
  },

  // A lost soul stumbles out of the portal and is taken in: new blood for
  // the houses. Only when there's a bed for them.
  stranger(state, data) {
    if (state.humans.length >= populationCap(state, data)) return false;
    const yard = portalYard(data);
    const h = createHuman(state, data, yard.rx + 2, yard.ry, { house: freshHouse(state, data) });
    h.knows = data.techs.filter((t) => t.starting).map((t) => t.id);
    state.humans.push(h);
    logEvent(state, `A stranger, ${h.name} of House ${h.house}, stumbled out of the portal and was taken in`);
    return true;
  },
};

// The sick lose strength each day until it passes; an Infirmary slows it and
// a herbal remedy from the stores cures it outright.
function updateSickness(state, data) {
  const ev = byId(data, 'plague');
  const infirmary = builtOfType(state, 'infirmary');
  for (const h of [...state.humans]) {
    if (!h.sick) continue;
    if (state.stockpile.herbal_remedy > 0) {
      state.stockpile.herbal_remedy--;
      h.sick = null;
      logEvent(state, `${h.name} was cured with a herbal remedy`);
      continue;
    }
    if (state.tick >= h.sick) {
      h.sick = null;
      logEvent(state, `${h.name} recovered from the sickness`);
      continue;
    }
    const frail = lifeStage(h, state, data) === 'adult' ? 1 : 1.5;
    h.health -= (infirmary ? ev.drainWithInfirmary : ev.drainPerDay) * frail;
    if (h.health <= 0) killHuman(state, data, h, 'sickness');
  }
}
