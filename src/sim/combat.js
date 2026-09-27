import { next } from './rng.js';
import { skillLevel } from './skills.js';
import { toolEffect, toolSum } from './items.js';

// Turn-based fights between a party and a group of monsters. Everyone acts
// once a round, fastest first (with a little luck). Heroes fight with
// whichever style suits them best: the sword (STR), the bow (AGI, strikes
// first, stays out of reach more) or, for those who know the Arcane Arts,
// magic (INT: ignores armour, and a practised mage mends the wounded).
// Defense skill, VIT and armour soak damage, and good defenders draw the
// monsters' attention. Every line of the fight goes into a battle report,
// and, for the battle viewer, a matching event [actor, target, kind, amount]
// (indexes into `castOf`; kinds: miss hit crit heal slain down dead flee).

const HERO_VERB = { swordsmanship: 'strikes', archery: 'shoots', magic: 'blasts' };

function styleAttack(h, data) {
  const sk = (s) => skillLevel(h, s);
  const out = {
    swordsmanship: (3 + h.stats.str * 0.8 + sk('swordsmanship') * 1.2) * toolEffect(h, data, 'swordsmanship', 'attack'),
    archery: (3 + h.stats.agi * 0.8 + sk('archery') * 1.2) * toolEffect(h, data, 'archery', 'attack'),
  };
  if (h.knows.includes('arcana') && sk('magic') >= 1) out.magic = (3 + h.stats.int * 0.9 + sk('magic') * 1.4) * toolEffect(h, data, 'magic', 'attack');
  return out;
}

export function heroFighter(h, data) {
  const styles = styleAttack(h, data);
  const style = Object.keys(styles).reduce((a, b) => (styles[b] > styles[a] ? b : a));
  const maxHp = maxHpOf(h);
  return {
    hero: true,
    id: h.id,
    name: h.name,
    style,
    maxHp,
    hp: (h.health / 100) * maxHp,
    atk: styles[style],
    def: h.stats.vit * 0.4 + skillLevel(h, 'defense') + toolSum(h, data, 'armor'),
    agi: h.stats.agi + (style === 'archery' ? 3 : 0),
    aggro: (style === 'swordsmanship' ? 1 : 0.6) + skillLevel(h, 'defense') * 0.3,
    heal: style === 'magic' && skillLevel(h, 'magic') >= data.dungeon.healFromMagic
      ? 4 + h.stats.int * 0.8 + skillLevel(h, 'magic') * 1.2 : 0,
    attacks: 0,
    hitsTaken: 0,
    kills: [],
  };
}

export function maxHpOf(h) {
  return Math.round(40 + h.stats.vit * 6 + h.level * 2);
}

// A rough single number for the party picker.
export function combatPower(h, data) {
  const f = heroFighter(h, data);
  return Math.round(f.atk * 2 + f.def * 2 + f.maxHp / 5);
}

// Numbers duplicates: "Cave Rat 1", "Cave Rat 2".
export function monsterFighters(data, ids) {
  const counts = {};
  for (const id of ids) counts[id] = (counts[id] ?? 0) + 1;
  const seen = {};
  return ids.map((id) => {
    const m = data.monstersById[id];
    seen[id] = (seen[id] ?? 0) + 1;
    return {
      hero: false,
      id,
      name: counts[id] > 1 ? `${m.name} ${seen[id]}` : m.name,
      maxHp: m.hp,
      hp: m.hp,
      atk: m.atk,
      def: m.def,
      agi: m.agi,
      verb: m.verb,
    };
  });
}

const standing = (list) => list.filter((f) => f.hp > 0);

// Who's in the fight, as the viewer needs them: index = position here.
export function castOf(heroes, monsters) {
  return [...heroes, ...monsters].map((f) => ({
    id: f.id, name: f.name, hero: f.hero, hp: Math.round(f.hp), maxHp: Math.round(f.maxHp), style: f.style ?? null,
  }));
}

// Runs the fight. Heroes left at 0 HP are `down` (can still be carried out),
// or `dead` if the blow went far past 0 (killed outright). When someone falls
// or the party as a whole is badly hurt, it flees, taking a parting blow from
// each monster.
// Returns { won, fled, rounds }. `events`, if given, gets one entry per line.
export function fight(state, data, heroes, monsters, lines, events = null) {
  const d = data.dungeon;
  [...heroes, ...monsters].forEach((f, i) => { f.ix = i; });
  const log = (text, e) => {
    lines.push(text);
    events?.push(e);
  };
  let round = 0;
  while (standing(heroes).length && standing(monsters).length && round < d.maxRounds) {
    round++;
    const order = standing([...heroes, ...monsters])
      .map((f) => ({ f, init: f.agi + next(state.rng) * 4 }))
      .sort((a, b) => b.init - a.init)
      .map((o) => o.f);
    for (const a of order) {
      if (a.hp <= 0) continue;
      const foes = standing(a.hero ? monsters : heroes);
      if (!foes.length) break;
      const hurt = a.heal && weakest(standing(heroes));
      if (hurt && hurt.hp < hurt.maxHp * 0.4) mend(state, a, hurt, log);
      else attack(state, data, a, a.hero ? weakest(foes) : pickByAggro(state, foes), log);
    }
    if (standing(heroes).length && standing(monsters).length && mustFlee(data, heroes)) {
      log('The party turns and flees!', [-1, -1, 'flee', 0]);
      for (const m of standing(monsters)) {
        const foes = standing(heroes);
        if (foes.length) attack(state, data, m, pickByAggro(state, foes), log);
      }
      return { won: false, fled: true, rounds: round };
    }
  }
  return { won: !standing(monsters).length, fled: false, rounds: round };
}

function mustFlee(data, heroes) {
  const hp = heroes.reduce((s, h) => s + Math.max(0, h.hp), 0);
  const max = heroes.reduce((s, h) => s + h.maxHp, 0);
  return heroes.some((h) => h.down || h.dead) || hp < max * data.dungeon.fleeBelow;
}

// Heroes focus the weakest foe, to thin the enemy out quickly.
function weakest(foes) {
  return foes.reduce((a, b) => (b.hp < a.hp ? b : a));
}

function pickByAggro(state, heroes) {
  let r = next(state.rng) * heroes.reduce((s, h) => s + h.aggro, 0);
  for (const h of heroes) if ((r -= h.aggro) < 0) return h;
  return heroes[0];
}

function mend(state, a, t, log) {
  const amount = Math.round(Math.min(t.maxHp - t.hp, a.heal * (0.8 + next(state.rng) * 0.4)));
  t.hp += amount;
  a.attacks++;
  log(`${a.name} mends ${t.name}'s wounds (+${amount}).`, [a.ix, t.ix, 'heal', amount]);
}

function attack(state, data, a, t, log) {
  const hit = Math.max(0.4, Math.min(0.95, 0.75 + (a.agi - t.agi) * 0.015));
  if (a.hero) a.attacks++;
  if (next(state.rng) >= hit) {
    log(`${a.name} misses ${t.name}.`, [a.ix, t.ix, 'miss', 0]);
    return;
  }
  const crit = next(state.rng) < (a.hero ? 0.05 + a.agi * 0.004 : data.dungeon.monsterCrit);
  const armour = a.style === 'magic' ? 0 : t.def * 0.5;
  const dmg = Math.max(1, Math.round(a.atk * (0.8 + next(state.rng) * 0.4) * (crit ? 1.8 : 1) - armour));
  t.hp -= dmg;
  if (t.hero) t.hitsTaken++;
  const verb = a.hero ? HERO_VERB[a.style] : a.verb;
  log(`${a.name} ${verb} ${t.name} for ${dmg}${crit ? ' (critical!)' : ''}.`, [a.ix, t.ix, crit ? 'crit' : 'hit', dmg]);
  if (t.hp > 0) return;
  if (!t.hero) {
    a.kills.push(t.id);
    log(`${t.name} is slain.`, [a.ix, t.ix, 'slain', 0]);
  } else if (-t.hp >= t.maxHp * data.dungeon.overkill) {
    t.dead = true;
    t.killedBy = t.killedBy ?? data.monstersById[a.id].name;
    log(`${t.name} is killed outright!`, [a.ix, t.ix, 'dead', 0]);
  } else {
    t.down = true;
    t.killedBy = data.monstersById[a.id].name;
    log(`${t.name} collapses!`, [a.ix, t.ix, 'down', 0]);
  }
}
