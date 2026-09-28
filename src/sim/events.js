import { chance, randInt, next } from './rng.js';
import { logEvent } from './history.js';
import { dateOf } from './time.js';
import { addFeeling, feel } from './mood.js';
import { bondValue, changeBond } from './bonds.js';
import { gainXp } from './skills.js';
import { lifeStage } from './lifecycle.js';
import { populationCap } from './settlement.js';
import { builtOfType } from './buildings.js';
import { castOf, combatPower, fight, heroFighter, monsterFighters } from './combat.js';
import { portalYard, listNames } from './dungeon.js';
import { createHuman, freshHouse, killHuman } from './human.js';
import { eventWeight } from './director.js';

// Things that happen to the sanctuary, from data/events.json, rolled once a
// day: monsters bursting out of the portal, festivals and good harvests,
// sickness, fire, feuds, a prodigy, a wandering bard, a lost stranger. Each
// has its own chance and conditions, scaled by the storyteller (director.js)
// by whether it's `good` or `bad` news.

const byId = (data, id) => data.events.find((e) => e.id === id);

export function updateEvents(state, data) {
  if (state.tick % data.config.time.ticksPerDay !== 0) return;
  updateSickness(state, data);
  const date = dateOf(state.tick, data.config.time);
  for (const ev of data.events) {
    if (date.year < (ev.minYear ?? 0) || (ev.season && ev.season !== date.season)) continue;
    if (ev.seasons && !ev.seasons.includes(date.season)) continue;
    if (ev.oncePerYear && state.eventYears?.[ev.id] === date.year) continue;
    if (!chance(state.rng, ev.chancePerDay * eventWeight(state, data, ev.kind))) continue;
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
    const events = [];
    const cast = castOf(heroes, monsters);
    const { won } = heroes.length ? fight(state, data, heroes, monsters, lines, events) : { won: false };
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
      for (const h of defenders) {
        feel(state, data, h, 'dungeonVictory', 'Defended the sanctuary');
        h.renown = (h.renown ?? 0) + data.config.rank.raidDefenseRenown;
      }
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
      reports: [{ title: `Raid: ${monsters.map((m) => m.name).join(', ')}`, lines: lines.slice(0, data.dungeon.maxReportLines), events: events.slice(0, data.dungeon.maxReportLines), cast, result: won ? 'repelled' : 'overrun' }],
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

  // A building catches fire: those nearby rush to put it out (and are
  // honoured for it, if not burned), and some of the stores go up in smoke.
  fire(state, data, ev) {
    const built = state.buildings.filter((b) => b.built);
    if (!built.length) return false;
    const b = built[randInt(state.rng, 0, built.length - 1)];
    const name = data.buildingsById[b.type].name;
    const near = state.humans.filter((h) => h.away == null && !h.punished && lifeStage(h, state, data) !== 'child')
      .sort((a, c) => (Math.abs(a.x - b.x) + Math.abs(a.y - b.y)) - (Math.abs(c.x - b.x) + Math.abs(c.y - b.y)))
      .slice(0, ev.helpers);
    state.stockpile.wood -= Math.floor(state.stockpile.wood * ev.woodLost);
    state.stockpile.food -= Math.floor(state.stockpile.food * ev.foodLost);
    const burned = [];
    for (const h of near) {
      h.renown = (h.renown ?? 0) + ev.renown;
      if (chance(state.rng, ev.burnChance)) {
        h.health = Math.max(5, h.health - randInt(state.rng, ev.burn[0], ev.burn[1]));
        burned.push(h);
      }
      feel(state, data, h, 'dungeonVictory', 'Fought the fire');
    }
    const who = near.length ? `. ${listNames(near.map((h) => h.name))} fought the flames` : '';
    const hurt = burned.length ? `, and ${listNames(burned.map((h) => h.name))} ${burned.length > 1 ? 'were' : 'was'} burned` : '';
    logEvent(state, `Fire broke out in the ${name}!${who}${hurt}`);
    return true;
  },

  // The fields give twice over.
  bounty(state, data, ev) {
    state.stockpile.food += state.humans.length * ev.foodPerPerson;
    logEvent(state, `The fields of ${state.settlement.name} gave twice over: a bountiful harvest`);
    return true;
  },

  // A child or youth shows a rare gift in whatever they're best at.
  prodigy(state, data, ev) {
    const young = state.humans.filter((h) => lifeStage(h, state, data) === 'child' && h.away == null);
    if (!young.length) return false;
    const h = young[randInt(state.rng, 0, young.length - 1)];
    const skill = data.skills[randInt(state.rng, 0, data.skills.length - 1)];
    const s = (h.skills[skill.id] ??= { level: 0, xp: 0 });
    s.level = Math.min(data.config.skills.maxLevel, s.level + ev.levels);
    logEvent(state, `${h.name}, still a child, showed a rare gift for ${skill.name.toLowerCase()}`);
    return true;
  },

  // Two who already dislike each other fall out for good.
  feud(state, data, ev) {
    const adults = state.humans.filter((h) => h.away == null && lifeStage(h, state, data) !== 'child');
    let pair = null;
    let worst = ev.bondBelow;
    for (let i = 0; i < adults.length; i++) {
      for (let j = i + 1; j < adults.length; j++) {
        const b = bondValue(state, adults[i], adults[j]);
        if (b < worst) {
          worst = b;
          pair = [adults[i], adults[j]];
        }
      }
    }
    if (!pair) return false;
    const [a, b] = pair;
    changeBond(state, data, a, b, ev.bond);
    addFeeling(state, data, a, `Feuding with ${b.name}`, ev.mood, ev.days);
    addFeeling(state, data, b, `Feuding with ${a.name}`, ev.mood, ev.days);
    logEvent(state, `A bitter feud broke out between ${a.name} and ${b.name}`);
    return true;
  },

  // A bard passes through and sings of the ruler, or of the greatest hero.
  bard(state, data, ev) {
    const ruler = state.humans.find((h) => h.id === state.settlement.leaderId);
    const hero = [...state.humans].sort((a, b) => (b.counters.bossKills ?? 0) - (a.counters.bossKills ?? 0) || b.level - a.level)[0];
    const subject = hero && (hero.counters.bossKills ?? 0) > 0 ? hero : ruler ?? hero;
    if (!subject) return false;
    subject.renown = (subject.renown ?? 0) + ev.renown;
    for (const h of state.humans) if (h.away == null) addFeeling(state, data, h, 'Heard the bard sing', ev.mood, ev.days);
    logEvent(state, `A wandering bard came to ${state.settlement.name} and sang of ${subject.name}`);
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
