import { logEvent } from './history.js';
import { isFamily } from './bonds.js';
import { lifeStage } from './lifecycle.js';
import { takeConsort, unwed, wed } from './dynasty.js';

// Once the ruler is the god's puppet, the god rules through them. Each
// decree is announced in the ruler's name, and the people obey:
//   wed   { aId, bId }  two people are married (a ruler may take a consort)
//   heir  { id }        one of the ruler's children is named heir
//   build { type }      the builders start this building (or upgrade) first
//   focus { focus }     the whole sanctuary turns to a calling for a while
// Returns an error message, or null.

const findHuman = (state, id) => state.humans.find((h) => h.id === id);

export function puppetRuler(state) {
  const id = state.dynasty.puppetId;
  return id != null && id === state.settlement.leaderId ? findHuman(state, id) : null;
}

export function issueDecree(state, data, target, title) {
  const ruler = puppetRuler(state);
  if (!ruler) return 'The ruler is not yours to command';
  const by = ` by decree of ${title(state, data, ruler)} ${ruler.name}`;
  const kind = DECREES[target.kind];
  if (!kind) return 'Unknown decree';
  return kind(state, data, ruler, target, by);
}

const DECREES = {
  wed(state, data, ruler, { aId, bId }, by) {
    const a = findHuman(state, aId);
    const b = findHuman(state, bId);
    if (!a || !b || a === b) return 'Choose two people';
    if (isFamily(a, b)) return 'They are family';
    if (lifeStage(a, state, data) === 'child' || lifeStage(b, state, data) === 'child') return 'Children cannot wed';
    // The ruler may take another spouse; anyone else must be free.
    const [r, other] = a === ruler ? [a, b] : b === ruler ? [b, a] : [null, null];
    if (r) {
      if (!unwed(state, data, other)) return `${other.name} is already wed`;
      if (r.partnerId == null) wed(state, data, r, other, by);
      else if ((r.consorts?.length ?? 0) >= data.config.dynasty.maxConsorts) return 'The ruler has as many consorts as the law allows';
      else takeConsort(state, data, r, other, by);
      return null;
    }
    if (!unwed(state, data, a) || !unwed(state, data, b)) return 'Both must be unwed';
    wed(state, data, a, b, by);
    return null;
  },

  heir(state, data, ruler, { id }, by) {
    const h = findHuman(state, id);
    if (!h || !h.parents.includes(ruler.id)) return 'The heir must be the ruler’s child';
    state.dynasty.heirId = h.id;
    logEvent(state, `${h.name} was named heir to the throne${by}`);
    return null;
  },

  build(state, data, ruler, { type }, by) {
    const def = data.buildingsById[type];
    if (!def) return 'Choose a building';
    state.decree = { build: type, until: state.tick + data.config.decrees.buildDays * data.config.time.ticksPerDay };
    const existing = state.buildings.find((b) => b.type === type && b.built);
    logEvent(state, existing ? `The ${def.name} is to be improved${by}` : `A ${def.name} is to be raised${by}`);
    return null;
  },

  focus(state, data, ruler, { focus }, by) {
    const f = data.focusesById[focus];
    if (!f) return 'Choose a calling';
    state.focus = { id: focus, until: state.tick + data.config.decrees.focusDays * data.config.time.ticksPerDay };
    logEvent(state, `The people are called to ${f.name}${by}`);
    return null;
  },
};

export function decreeCost(data, kind) {
  return data.config.decrees.cost[kind] ?? 20;
}
