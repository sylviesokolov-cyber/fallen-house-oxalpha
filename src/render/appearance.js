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

export function appearance(h, elder = false) {
  const k = hash(h.id);
  return {
    skin: SKIN[k % SKIN.length],
    hair: elder ? HAIR[7] : HAIR[(k >>> 4) % 7],
    tunic: TUNIC[bestSkill(h)] ?? NOVICE,
    longHair: h.sex === 'female' ? (k >>> 8) % 4 !== 0 : (k >>> 8) % 5 === 0,
  };
}
