import { next, randInt } from './rng.js';
import { logEvent } from './history.js';
import { addFeeling } from './mood.js';

// Heroes: every person has a grade (1-5 stars, their potential), five stats,
// and a character level. All XP they earn from work also levels them up, and
// each level gives stat points that go mostly to the stats their work uses.

function rollGrade(state, data) {
  const total = data.grades.reduce((s, g) => s + g.weight, 0);
  let r = next(state.rng) * total;
  for (const g of data.grades) {
    if ((r -= g.weight) < 0) return g.stars;
  }
  return 1;
}

// Children usually take after their parents' grade, give or take a star.
export function inheritGrade(state, data, parents) {
  if (!parents.length || next(state.rng) >= data.config.stats.childInheritChance) return rollGrade(state, data);
  const avg = Math.round(parents.reduce((s, p) => s + p.grade, 0) / parents.length);
  return Math.max(1, Math.min(5, avg + randInt(state.rng, -1, 1)));
}

export function newHeroFields(state, data, grade = rollGrade(state, data)) {
  const c = data.config.stats;
  const stats = {};
  for (const s of data.stats) stats[s.id] = randInt(state.rng, c.rollMin, c.rollMax);
  // Higher grades start with bonus points scattered across their stats.
  for (let k = 0; k < gradeOf(data, grade).statBonus; k++) stats[data.stats[randInt(state.rng, 0, data.stats.length - 1)].id]++;
  return { grade, stats, level: 1, xp: 0, statXp: {}, statPoints: 0 };
}

export function gradeOf(data, stars) {
  return data.grades[stars - 1];
}

// 1 at the base value (5); each point above or below changes it by perPoint.
export function statFactor(h, data, statId) {
  const c = data.config.stats;
  const f = 1 + (h.stats[statId] - c.base) * data.statsById[statId].perPoint;
  return Math.max(c.minFactor, Math.min(c.maxFactor, f));
}

export function xpForLevel(level, data) {
  const l = data.config.level;
  return Math.round(l.xpBase * l.xpGrowth ** (level - 1));
}

// Called with the XP a person just earned in a skill.
export function gainCharacterXp(state, data, h, xp, skillId) {
  const l = data.config.level;
  const stat = data.skillsById[skillId].stat;
  h.statXp[stat] = (h.statXp[stat] ?? 0) + xp;
  if (h.level >= l.max) return;
  h.xp += xp;
  while (h.level < l.max && h.xp >= xpForLevel(h.level, data)) {
    h.xp -= xpForLevel(h.level, data);
    h.level++;
    h.statPoints += gradeOf(data, h.grade).pointsPerLevel;
    while (h.statPoints >= 1) {
      h.statPoints--;
      h.stats[pickGrowthStat(state, data, h)]++;
    }
    const [value, days] = data.config.feelings.levelUp;
    addFeeling(state, data, h, `Reached level ${h.level}`, value, days);
    if (h.level % l.logEvery === 0) logEvent(state, `${h.name} reached level ${h.level}`);
  }
}

// Stats grow where the person has been putting in the work, with some chance.
function pickGrowthStat(state, data, h) {
  const weights = data.stats.map((s) => (h.statXp[s.id] ?? 0) + 20);
  let r = next(state.rng) * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    if ((r -= weights[i]) < 0) return data.stats[i].id;
  }
  return data.stats[0].id;
}

// "Master Woodcutter", "Skilled Miner"... from their best skill. Everyone
// forages when they eat, so foraging only names someone who stands out at it.
const EVERYONE_DOES = { foraging: 3 };

export function heroClass(h, data) {
  let best = null;
  for (const [id, s] of Object.entries(h.skills)) {
    const rank = s.level - (EVERYONE_DOES[id] ?? 0);
    if (!best || rank > best.rank) best = { id, level: s.level, rank };
  }
  if (!best || best.level < 1) return 'Novice';
  const noun = data.skillsById[best.id].noun;
  const cap = noun[0].toUpperCase() + noun.slice(1);
  const rank = best.level >= 10 ? 'Master' : best.level >= 6 ? 'Skilled' : best.level >= 3 ? 'Capable' : 'Apprentice';
  return `${rank} ${cap}`;
}
