import { chance } from './rng.js';
import { logEvent } from './history.js';
import { addFeeling } from './mood.js';
import { lifeStage } from './lifecycle.js';
import { attractedTo, bondValue, isFamily } from './bonds.js';
import { appeal } from './appeal.js';

// Families and the throne. Everyone belongs to a house (a family name passed
// down from the father, or from the mother if she rules). The ruler may take
// consorts beyond their first spouse: a consort's partnerId points at the
// ruler, and the ruler lists them in `consorts`. When a ruler dies the throne
// passes by blood: the named heir, else the eldest grown child, else a
// sibling, else the spouse; only failing all of those do the people choose a
// new ruler from another house. Once the throne has passed from parent to
// child, the house is royal and its rulers are Kings and Queens.
//
// state.dynasty: { house, royal, generation, heirId, puppetId,
//   rulers: [{ id, name, house, from, to, how }] }

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth'];
const findHuman = (state, id) => state.humans.find((h) => h.id === id);
const adult = (state, data, h) => lifeStage(h, state, data) !== 'child';

export function newDynasty() {
  return { house: null, royal: false, generation: 0, heirId: null, puppetId: null, rulers: [] };
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

// Once a day a ruler may court: an unwed ruler marries, a wed one takes
// another consort, from those who've caught their eye and are close to them.
// An aging ruler may step down for a grown heir.
export function updateDynasty(state, data, ruler) {
  const d = data.config.dynasty;
  if (!ruler || !adult(state, data, ruler) || ruler.away != null) return;
  if (lifeStage(ruler, state, data) === 'elder' && chance(state.rng, d.abdicateChancePerDay)) {
    const next = successorOf(state, data, ruler, false);
    if (next) return abdicate(state, data, ruler, next);
  }
  if ((ruler.consorts?.length ?? 0) >= d.maxConsorts || !chance(state.rng, d.consortChancePerDay)) return;
  let best = null;
  let bestScore = -Infinity;
  for (const c of state.humans) {
    if (c === ruler || !unwed(state, data, c) || isFamily(ruler, c)) continue;
    if (!attractedTo(ruler, c) || !attractedTo(c, ruler)) continue;
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
  state.settlement.leaderId = next.ruler.id;
  crown(state, data, next.ruler, next.how, ruler, (s, dt, h) => (s.dynasty.royal || next.how !== 'spouse'
    ? dt.config.leader.royalTitle : dt.config.leader.title)[h.sex]);
}

// The next ruler after `prev` (a living person or a record of the dead).
// Returns { ruler, how } or null if the throne should go to a vote.
export function successorOf(state, data, prev, spouseToo = true) {
  if (!prev) return null;
  const alive = (h) => h && h !== prev && state.humans.includes(h) && adult(state, data, h);
  const heir = findHuman(state, state.dynasty.heirId);
  if (alive(heir)) return { ruler: heir, how: 'heir' };
  const eldest = (list) => list.filter(alive).sort((a, b) => a.birthDay - b.birthDay)[0];
  const child = eldest(state.humans.filter((o) => o.parents.includes(prev.id)));
  if (child) return { ruler: child, how: 'child' };
  const sibling = eldest(state.humans.filter((o) => o.id !== prev.id && prev.parents?.length && o.parents.some((p) => prev.parents.includes(p))));
  if (sibling) return { ruler: sibling, how: 'sibling' };
  const spouse = findHuman(state, prev.partnerId);
  if (spouseToo && alive(spouse)) return { ruler: spouse, how: 'spouse' };
  return null;
}

// Records a new reign and says so in the log.
export function crown(state, data, ruler, how, prev, title) {
  const dy = state.dynasty;
  const last = dy.rulers.at(-1);
  if (last && last.to == null) last.to = state.tick;
  const sameHouse = ruler.house === dy.house;
  if (!sameHouse) {
    dy.house = ruler.house;
    dy.generation = 1;
    dy.royal = false;
  } else if (how === 'child' || how === 'heir') {
    dy.generation++;
    if (!dy.royal && ruler.parents.includes(prev?.id)) dy.royal = true;
  }
  dy.heirId = null;
  dy.rulers.push({ id: ruler.id, name: ruler.name, house: ruler.house, from: state.tick, to: null, how });
  const place = state.settlement.name;
  const t = title(state, data, ruler);
  const text = {
    heir: `${ruler.name}, heir of ${prev?.name}, became ${t} of ${place}`,
    child: `${ruler.name}, ${ruler.sex === 'female' ? 'daughter' : 'son'} of ${prev?.name}, became ${t} of ${place}`,
    sibling: `${ruler.name}, sibling of ${prev?.name}, became ${t} of ${place}`,
    spouse: `${ruler.name}, widowed spouse of ${prev?.name}, became ${t} of ${place}`,
    chosen: `${ruler.name} of House ${ruler.house} became ${t} of ${place}`,
  }[how];
  logEvent(state, text);
  if (!sameHouse && prev) logEvent(state, `House ${ruler.house} now holds the throne of ${place}`);
  if (dy.royal && dy.generation === 2 && sameHouse) logEvent(state, `House ${ruler.house} is now a royal house`);
}
