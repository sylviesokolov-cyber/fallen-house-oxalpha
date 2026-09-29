// How a person looks, worked out from their id and what they do, so the map
// sprite and the character-sheet portrait always match. Rendering only.

const SKIN = ['#f3d2b3', '#e8b98f', '#d19a6a', '#a8714a', '#7a4e32', '#f6dcc8'];
const HAIR = ['#2b1d14', '#4a2f1d', '#7a4a24', '#b07a3a', '#d8b56a', '#1b1b1b', '#8a3b1f', '#c9c9c2'];

// Tunic colour by what they're best at.
const TUNIC = {
  swordsmanship: '#b8433a', archery: '#4f8a3a', defense: '#6d7a8c', magic: '#6d4bd1',
  farming: '#7da33e', woodcutting: '#8a5a2b', cooking: '#d9822b', building: '#a07440', carpentry: '#b5824a',
  smithing: '#50535c', healing: '#e8e2d0', teaching: '#3b82b6', research: '#3a5a9a',
};
const NOVICE = '#9aa3ad';

function hash(n) {
  let h = (n * 2654435761) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  return (h ^ (h >>> 13)) >>> 0;
}

export function bestSkill(h) {
  let best = null;
  for (const [id, s] of Object.entries(h.skills ?? {})) if (s.level >= 1 && (!best || s.level > h.skills[best].level)) best = id;
  return best;
}

// House colours: every family name maps to one, so kin share a sash.
const HOUSE = ['#c0392b', '#2e86c1', '#27ae60', '#8e44ad', '#d4ac0d', '#16a085', '#d35400', '#7f8c8d', '#e84393', '#1f3a93'];
const HAIR_STYLES = { female: ['long', 'long', 'bun', 'braid', 'short'], male: ['short', 'short', 'spiky', 'long', 'shaggy'] };
const GEAR_SLOTS = ['staff', 'sword', 'bow'];

export function houseColor(house) {
  let n = 0;
  for (const ch of house ?? '') n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return HOUSE[n % HOUSE.length];
}

// The weapon they carry: their best fighting gear, if any.
function gearOf(h, data) {
  if (!data || !h.tools) return null;
  const slots = new Set(Object.keys(h.tools).map((id) => data.itemsById[id]?.slot).filter(Boolean));
  return GEAR_SLOTS.find((s) => slots.has(s)) ?? null;
}

export function appearance(h, elder = false, data = null) {
  const k = hash(h.id);
  const male = h.sex !== 'female';
  const styles = HAIR_STYLES[male ? 'male' : 'female'];
  let hairStyle = styles[(k >>> 8) % styles.length];
  if (male && elder && (k >>> 20) % 2 === 0) hairStyle = 'bald';
  const str = h.stats?.str ?? 8;
  return {
    skin: SKIN[k % SKIN.length],
    // A few young women have the sprite's pink or silver hair.
    hair: elder ? HAIR[7] : !male && (k >>> 22) % 9 === 0 ? '#e89aa8' : !male && (k >>> 22) % 9 === 1 ? '#d8d8e0' : HAIR[(k >>> 4) % 7],
    tunic: TUNIC[bestSkill(h)] ?? NOVICE,
    longHair: ['long', 'braid'].includes(hairStyle),
    hairStyle,
    beard: male && ((k >>> 12) % 3 === 0 || (elder && (k >>> 12) % 3 !== 2)),
    build: str >= 14 ? 'broad' : str <= 7 ? 'slim' : 'normal',
    sash: h.house ? houseColor(h.house) : null,
    gear: gearOf(h, data),
    eyes: ['#3b2a1a', '#2d5a8a', '#3a6a3a', '#5a4a2a'][(k >>> 16) % 4],
    beauty: h.looks ?? 5,
  };
}
