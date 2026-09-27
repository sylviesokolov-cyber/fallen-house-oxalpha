import { chance, randInt } from './rng.js';
import { logEvent } from './history.js';
import { addFeeling, mood } from './mood.js';
import { lifeStage } from './lifecycle.js';
import { bondValue, changeBond } from './bonds.js';
import { builtOfType } from './buildings.js';
import { rankIndex } from './rank.js';
import { killHuman } from './human.js';
import { rulerTitle } from './dynasty.js';

// Crime and justice. Once a day each grown person may be tempted: hunger,
// misery, low rank, envy and their nature push them towards it; the law's
// harshness, a Watch House, a Market and recent punishments hold them back.
// A crime is theft from the stores or an attack on a rival. Whether the
// culprit is caught depends on who was near, the watch, and the victim. The
// ruler's law (lenient, fair or harsh; set by his nature, or by decree)
// decides the sentence: a fine and shame, the stocks, the cells, a flogging,
// and exile for those who won't stop.

const DAY = (data) => data.config.time.ticksPerDay;

// The law of the land: decreed for this reign, else the ruler's nature.
export function lawLevel(state, data) {
  const ruler = state.humans.find((h) => h.id === state.settlement.leaderId);
  if (state.law && state.law.by === ruler?.id) return state.law.level;
  if (ruler?.traits.includes('kind')) return 'lenient';
  if (ruler?.traits.includes('aggressive')) return 'harsh';
  return 'fair';
}

export function temptation(state, data, h) {
  const c = data.config.crime;
  let f = 1;
  if (h.needs.hunger < c.hungryBelow) f += c.hungry;
  if (mood(h) < c.unhappyBelow) f += c.unhappy;
  if (h.spurUntil != null && state.tick < h.spurUntil) f += c.spurred;
  f *= c.rankFactor[Math.max(0, rankIndex(state, data, h))] ?? 1;
  for (const t of h.traits) f *= c.traits[t] ?? 1;
  f *= c.law[lawLevel(state, data)];
  if (builtOfType(state, 'watch_house')) f *= c.watch;
  if (builtOfType(state, 'market')) f *= c.market;
  if (state.justice?.lastPunish != null && state.tick - state.justice.lastPunish < c.recentPunishDays * DAY(data)) f *= c.recentPunish;
  return c.baseChancePerDay * f;
}

const onMap = (state, data, h) => h.away == null && !h.punished && lifeStage(h, state, data) !== 'child';

export function updateCrime(state, data) {
  if (state.tick % DAY(data) !== 0) return;
  const level = lawLevel(state, data);
  for (const h of [...state.humans]) {
    if (level === 'harsh' && lifeStage(h, state, data) !== 'child') addFeeling(state, data, h, 'Fears the harsh law', data.config.crime.harshFear, 1);
    if (!state.humans.includes(h) || !onMap(state, data, h) || h.id === state.settlement.leaderId) continue;
    if (chance(state.rng, temptation(state, data, h))) commitCrime(state, data, h);
  }
}

export function commitCrime(state, data, h, kind = null) {
  const c = data.config.crime;
  let rival = null;
  for (const o of state.humans) {
    if (o === h || !onMap(state, data, o)) continue;
    const b = bondValue(state, h, o);
    if (b < c.rivalBelow && (!rival || b < bondValue(state, h, rival))) rival = o;
  }
  const assault = kind ? kind === 'assault' && rival : rival && (h.traits.includes('aggressive') || chance(state.rng, c.assaultChance));
  const crime = assault ? attack(state, data, h, rival) : steal(state, data, h);
  if (!crime) return null;
  state.tribeCounters.crimes = (state.tribeCounters.crimes ?? 0) + 1;
  const witnesses = state.humans.filter((o) => o !== h && o.away == null && o.action.type !== 'sleep'
    && lifeStage(o, state, data) !== 'child' && Math.abs(o.x - h.x) <= c.witnessRadius && Math.abs(o.y - h.y) <= c.witnessRadius).length;
  let p = c.detectBase + witnesses * c.detectPerWitness;
  if (builtOfType(state, 'watch_house')) p += c.detectWatch;
  if (assault) p += c.detectAssault;
  if (chance(state.rng, Math.min(c.detectMax, p))) {
    sentence(state, data, h, crime);
    return { ...crime, caught: true };
  }
  h.counters.secretCrimes = (h.counters.secretCrimes ?? 0) + 1;
  logEvent(state, crime.unsolved);
  return { ...crime, caught: false };
}

function steal(state, data, h) {
  const c = data.config.crime;
  const s = state.stockpile;
  const meals = data.items.filter((d) => d.kind === 'meal' && s[d.id] > 0);
  let item;
  let n;
  if (meals.length) {
    item = meals[randInt(state.rng, 0, meals.length - 1)];
    n = Math.min(s[item.id], randInt(state.rng, c.theftMeals[0], c.theftMeals[1]));
    s[item.id] -= n;
  } else if (s.food > 0) {
    item = { id: 'food', name: 'Potatoes' };
    n = Math.min(s.food, randInt(state.rng, c.theftFood[0], c.theftFood[1]));
    s.food -= n;
  } else return null;
  h.needs.hunger = Math.min(100, h.needs.hunger + 40);
  const what = `${n} ${item.name.toLowerCase()}`;
  return {
    kind: 'theft', item: item.id, n,
    doing: `stealing ${what} from the stores`,
    unsolved: `${what[0].toUpperCase()}${what.slice(1)} went missing from the stores. Nobody saw the thief`,
  };
}

function attack(state, data, h, victim) {
  const c = data.config.crime;
  const dmg = randInt(state.rng, c.assaultDamage[0], c.assaultDamage[1]);
  victim.health = Math.max(5, victim.health - dmg);
  changeBond(state, data, h, victim, -20);
  addFeeling(state, data, victim, `Attacked by ${h.name}`, -10, 6);
  return {
    kind: 'assault', victimId: victim.id,
    doing: `attacking ${victim.name}`,
    unsolved: `${victim.name} was set upon by someone unseen`,
  };
}

// The ruler passes sentence under the law of the land.
function sentence(state, data, h, crime) {
  const level = lawLevel(state, data);
  const sen = data.config.crime.sentences[level];
  const ruler = state.humans.find((o) => o.id === state.settlement.leaderId);
  const by = ruler ? ` by order of ${rulerTitle(state, data, ruler)} ${ruler.name}` : '';
  h.crimes = (h.crimes ?? 0) + 1;
  h.renown = (h.renown ?? 0) + sen.renown;
  h.outcastUntil = state.tick + sen.outcastDays * DAY(data);
  if (crime.kind === 'theft') state.stockpile[crime.item] += Math.ceil(crime.n / 2);
  state.justice = { lastPunish: state.tick };
  const victim = state.humans.find((o) => o.id === crime.victimId);
  if (victim) addFeeling(state, data, victim, 'Justice was done', 6, 4);
  if (sen.exileAfter && h.crimes >= sen.exileAfter) {
    killHuman(state, data, h, 'exile', `was caught ${crime.doing} once too often and was exiled from ${state.settlement.name}${by}`);
    return;
  }
  const watch = builtOfType(state, 'watch_house');
  const jailed = sen.jailDays && watch && state.humans.filter((o) => o.punished?.kind === 'jail').length < (data.buildingsById.watch_house.effects.cells ?? 1);
  const days = jailed ? sen.jailDays : sen.stocksDays;
  let fate = 'fined and shamed';
  if (days) {
    h.punished = { kind: jailed ? 'jail' : 'stocks', until: state.tick + days * DAY(data), buildingId: jailed ? watch.id : null };
    fate = jailed ? `thrown in the cells for ${days} days` : `put in the stocks for ${days === 1 ? 'a day' : `${days} days`}`;
  }
  if (sen.flog) {
    h.health = Math.max(5, h.health - sen.flog);
    fate = `flogged and ${fate}`;
  }
  addFeeling(state, data, h, 'Shamed before everyone', -12, sen.outcastDays > 20 ? 10 : 5);
  logEvent(state, `${h.name} was caught ${crime.doing} and ${fate}${by}`);
}
