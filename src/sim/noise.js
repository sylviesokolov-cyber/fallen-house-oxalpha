import { next } from './rng.js';

// Value noise: random values on a coarse lattice, smoothly interpolated between
// lattice points. Summing a few lattice sizes ("octaves") gives natural blobs.

const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

function valueLayer(rng, w, h, cell) {
  const gw = Math.ceil(w / cell) + 1;
  const gh = Math.ceil(h / cell) + 1;
  const lattice = Array.from({ length: gw * gh }, () => next(rng));
  const out = new Array(w * h);
  for (let y = 0; y < h; y++) {
    const gy = y / cell;
    const y0 = Math.floor(gy);
    const ty = smooth(gy - y0);
    for (let x = 0; x < w; x++) {
      const gx = x / cell;
      const x0 = Math.floor(gx);
      const tx = smooth(gx - x0);
      const i = y0 * gw + x0;
      const top = lerp(lattice[i], lattice[i + 1], tx);
      const bottom = lerp(lattice[i + gw], lattice[i + gw + 1], tx);
      out[y * w + x] = lerp(top, bottom, ty);
    }
  }
  return out;
}

// octaves: [[cellSize, weight], ...]. Result is normalized to 0..1.
export function fractalNoise(rng, w, h, octaves) {
  const sum = new Array(w * h).fill(0);
  for (const [cell, weight] of octaves) {
    const layer = valueLayer(rng, w, h, cell);
    for (let i = 0; i < sum.length; i++) sum[i] += layer[i] * weight;
  }
  let min = Infinity;
  let max = -Infinity;
  for (const v of sum) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  return sum.map((v) => (v - min) / range);
}
