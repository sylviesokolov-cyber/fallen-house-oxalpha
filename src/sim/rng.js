// Seeded RNG (mulberry32). The state is a plain object { s } stored inside the
// sim state, so saving and loading resumes the exact same random sequence.

export function createRng(seed) {
  return { s: hashSeed(String(seed)) };
}

// FNV-1a: turns any seed string into a 32-bit integer.
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Returns a float in [0, 1).
export function next(rng) {
  let t = (rng.s = (rng.s + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(rng, min, max) {
  return min + Math.floor(next(rng) * (max - min + 1));
}

export function pick(rng, arr) {
  return arr[Math.floor(next(rng) * arr.length)];
}

export function chance(rng, p) {
  return next(rng) < p;
}
