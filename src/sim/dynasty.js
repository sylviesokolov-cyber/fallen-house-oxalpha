import { chance } from './rng.js';
import { logEvent } from './history.js';
import { addFeeling } from './mood.js';
import { lifeStage } from './lifecycle.js';
import { attractedTo, bondValue, isFamily } from './bonds.js';
import { appeal } from './appeal.js';

// Families and the throne. Everyone belongs to a house (a family name passed
// down from the father, or from the royal heiress). Only men rule; a ruler
// may take wives beyond his first: a wife's partnerId points at the ruler,
// and the ruler lists the others in `consorts`.
//
// When a ruler dies the crown passes along the royal line: the named heir,
// else the eldest grown son, else the eldest grown daughter as heiress. An
// heiress holds the throne as Princess until she weds; then her husband is
// King, and only her children (not his by other wives) are next in line.
// Failing a son or daughter, it goes to a brother (or sister), and failing
// all kin the people choose a new ruler, a man of another house. Once the
// crown has passed from parent to child the house is royal.
//
// state.dynasty: { house, royal, generation, heirId, heiressId, puppetId,
//   rulers: [{ id, name, house, from, to, how }] }

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth'];
const findHuman = (state, id) => state.humans.find((h) => h.id === id);
const findAny = (state, id) => findHuman(state, id) ?? state.dead.find((h) => h.id === id);
const adult = (state, data, h) => lifeStage(h, state, data) !== 'child';

export function newDynasty() {
  return { house: null, royal: false, generation: 0, heirId: null, heiressId: null, puppetId: null, rulers: [] };
}

export function isSpouse(a, b) {
  return a.partnerId === b.id || b.partnerId === a.id;
}

export function spousesOf(state, h) {
  const ids = new Set([h.partnerId, ...(h.consorts ?? [])]);
  return state.humans.filter((o) => ids.has(o.id));
}

// Free to marry: grown, unwed, and not already a ruler's spouse.
export function unwed(state, data, h) {
  return adult(state, data, h) && h.partnerId == null && !(h.consorts?.length);
}

// Marks a death among the married. Returns the spouses left behind.
export function widow(state, h) {
  const left = state.humans.filter((o) => o.partnerId === h.id || o.id === h.partnerId);
  for (const o of left) {
    if (o.consorts?.includes(h.id)) o.consorts = o.consorts.filter((id) => id !== h.id);
    if (o.partnerId === h.id) {
      o.partnerId = null;
      // A ruler who loses their first spouse raises their eldest consort.
      if (o.consorts?.length) {
        o.partnerId = o.consorts.shift();
      }
    }
  }
  if (state.dynasty?.heirId === h.id) state.dynasty.heirId = null;
  if (state.dynasty?.puppetId === h.id) state.dynasty.puppetId = null;
  return left;
}

const spouseWord = (h) => (h.sex === 'female' ? 'wife' : 'husband');

export function wed(state, data, a, b, how = '') {
  a.partnerId = b.id;
  b.partnerId = a.id;
  const m = data.config.mood;
  addFeeling(state, data, a, `Wed to ${b.name}`, m.joyValue, m.joyDays);
  addFeeling(state, data, b, `Wed to ${a.name}`, m.joyValue, m.joyDays);
  logEvent(state, `${a.name} and ${b.name} became partners${how}`);
  // An heiress who holds the throne makes her husband King.
  const ruling = [a, b].find((h) => h.id === state.settlement.leaderId && h.sex === 'female');
  if (ruling) {
    const husband = ruling === a ? b : a;
    state.settlement.leaderId = husband.id;
    state.dynasty.heiressId = ruling.id;
    crown(state, data, husband, 'marriage', ruling);
  }
}

export function takeConsort(state, data, ruler, c, how = '') {
  c.partnerId = ruler.id;
  (ruler.consorts ??= []).push(c.id);
  const d = data.config.dynasty;
  const nth = ORDINAL[ruler.consorts.length] ?? 'next';
  const their = ruler.sex === 'female' ? 'her' : 'his';
  logEvent(state, `${ruler.name} took ${c.name} as ${their} ${nth} ${spouseWord(c)}${how}`);
  const m = data.config.mood;
  addFeeling(state, data, c, `Wed to ${ruler.name}`, m.joyValue, m.joyDays);
  addFeeling(state, data, ruler, `Wed to ${c.name}`, m.joyValue, m.joyDays);
  const first = findHuman(state, ruler.partnerId);
  if (first) addFeeling(state, data, first, `Shares ${ruler.name} with ${c.name}`, d.jealousyValue, d.jealousyDays);
}

// Once a day a ruler may court: an unwed ruler marries (an heiress takes a
// husband, who becomes King), a wed King takes another wife, from those
// who've caught his eye and are close to him. An aging King may step down.
export function updateDynasty(state, data, ruler) {
  const d = data.config.dynasty;
  if (!ruler || !adult(state, data, ruler) || ruler.away != null) return;
  const female = ruler.sex === 'female';
  if (female && state.dynasty.heiressId == null) state.dynasty.heiressId = ruler.id;
  if (!female && lifeStage(ruler, state, data) === 'elder' && chance(state.rng, d.abdicateChancePerDay)) {
    const next = successorOf(state, data, ruler);
    if (next) return abdicate(state, data, ruler, next);
  }
  if (female && ruler.partnerId != null) return;
  if ((ruler.consorts?.length ?? 0) >= d.maxConsorts || !chance(state.rng, d.consortChancePerDay)) return;
  let best = null;
  let bestScore = -Infinity;
  for (const c of state.humans) {
    if (c === ruler || !unwed(state, data, c) || isFamily(ruler, c) || !attractedTo(ruler, c)) continue;
    const bond = bondValue(state, ruler, c);
    const fancy = appeal(state, data, ruler, c);
    if (bond < d.consortBondAt || fancy < d.consortAppealAt) continue;
    if (bond + fancy > bestScore) {
      bestScore = bond + fancy;
      best = c;
    }
  }
  if (!best) return;
  if (ruler.partnerId == null) wed(state, data, ruler, best);
  else takeConsort(state, data, ruler, best);
}

function abdicate(state, data, ruler, next) {
  logEvent(state, `${ruler.name} stepped down from the throne in old age`);
  seat(state, data, next, ruler);
}

// Puts a successor on the throne: a man directly, or an heiress, whose
// husband (if she has one) rules in her right.
export function seat(state, data, next, prev) {
  if (!next.heiress) {
    state.dynasty.heiressId = null;
    state.settlement.leaderId = next.ruler.id;
    crown(state, data, next.ruler, next.how, prev);
    return;
  }
  state.dynasty.heiressId = next.heiress.id;
  state.settlement.leaderId = next.ruler.id;
  crown(state, data, next.ruler, next.how, prev, next.via);
}

// Whose children inherit: the heiress if the crown runs through her, else
// the ruler himself.
export function royalLine(state, ruler) {
  return findAny(state, state.dynasty.heiressId) ?? ruler;
}

// The next ruler after `prev` (a living person or a record of the dead).
// Returns { ruler, how, heiress? } or null if the throne should go to a vote.
export function successorOf(state, data, prev) {
  if (!prev) return null;
  const line = royalLine(state, prev) ?? prev;
  const alive = (h) => h && h !== prev && state.humans.includes(h) && adult(state, data, h);
  const eldest = (list) => list.filter(alive).sort((a, b) => a.birthDay - b.birthDay)[0];
  const byWoman = (h, how) => {
    const husband = findHuman(state, h.partnerId);
    return alive(husband) && husband.sex === 'male' ? { ruler: husband, how: 'marriage', heiress: h, via: how } : { ruler: h, how, heiress: h };
  };
  const pickFrom = (list, how) => {
    const son = eldest(list.filter((o) => o.sex === 'male'));
    if (son) return { ruler: son, how };
    const daughter = eldest(list.filter((o) => o.sex === 'female'));
    return daughter ? byWoman(daughter, how) : null;
  };
  const heir = findHuman(state, state.dynasty.heirId);
  if (alive(heir)) return heir.sex === 'male' ? { ruler: heir, how: 'heir' } : byWoman(heir, 'heir');
  const child = pickFrom(state.humans.filter((o) => o.parents.includes(line.id)), 'child');
  if (child) return child;
  // A widowed heiress keeps the crown for her line.
  if (line !== prev && alive(line)) return byWoman(line, 'widow');
  const sibling = pickFrom(state.humans.filter((o) => o.id !== line.id && line.parents?.length && o.parents.some((p) => line.parents.includes(p))), 'sibling');
  return sibling;
}

// Records a new reign and says so in the log.
// `via` is how the heiress came to the crown when her husband takes it.
export function crown(state, data, ruler, how, prev, via = null) {
  const dy = state.dynasty;
  const last = dy.rulers.at(-1);
  if (last && last.to == null) last.to = state.tick;
  const heiress = findAny(state, dy.heiressId);
  const house = heiress && how !== 'chosen' ? heiress.house : ruler.house;
  const sameHouse = house === dy.house;
  if (!sameHouse) {
    dy.house = house;
    dy.generation = 1;
    dy.royal = false;
  } else if (['child', 'heir'].includes(how === 'marriage' ? via : how)) {
    const blood = how === 'marriage' ? heiress : ruler;
    dy.generation++;
    if (!dy.royal && blood.parents.includes(prev?.id)) dy.royal = true;
  }
  dy.heirId = null;
  dy.rulers.push({ id: ruler.id, name: ruler.name, house: ruler.house, from: state.tick, to: null, how });
  const place = state.settlement.name;
  const t = rulerTitle(state, data, ruler);
  const child = (h) => (h.sex === 'female' ? 'daughter' : 'son');
  const text = {
    heir: `${ruler.name}, heir of ${prev?.name}, became ${t} of ${place}`,
    child: `${ruler.name}, ${child(ruler)} of ${prev?.name}, became ${t} of ${place}`,
    sibling: `${ruler.name}, sibling of ${prev?.name}, became ${t} of ${place}`,
    widow: `${ruler.name} holds the throne of ${place} for her line`,
    marriage: `${ruler.name}, husband of ${heiress?.name}, became ${t} of ${place} in her right`,
    chosen: `${ruler.name} of House ${ruler.house} became ${t} of ${place}`,
  }[how];
  logEvent(state, text);
  if (!sameHouse && prev) logEvent(state, `House ${house} now holds the throne of ${place}`);
  if (dy.royal && dy.generation === 2 && sameHouse && ['child', 'heir'].includes(how === 'marriage' ? via : how)) logEvent(state, `House ${house} is now a royal house`);
}

// King (or Warden) for a man; an heiress ruling alone is a Princess (or Lady).
export function rulerTitle(state, data, h) {
  const l = data.config.leader;
  return (state.dynasty?.royal ? l.royalTitle : l.title)[h.sex];
}
