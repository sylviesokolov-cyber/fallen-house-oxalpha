import { iconDataUrl } from '../ui/icons.js';

// Textures made at start-up instead of loaded from files: trees at each
// stage of growth, potato plants, particle sprites, and the UI icon set (so
// activity bubbles over people match the rest of the game). Drawn at 2x and
// shown at half scale so they stay crisp when zoomed.

export const BUBBLE_ICONS = ['shield', 'hammer', 'meal', 'sword', 'book', 'faith', 'ale', 'wood', 'potato', 'remedy', 'magic', 'heart', 'portal', 'ore', 'bulb', 'sparkle'];

// Called from BootScene.preload: the icons are SVGs, which Phaser loads.
export function preloadIcons(scene) {
  for (const n of BUBBLE_ICONS) scene.load.svg(`ic-${n}`, iconDataUrl(n, 48), { width: 48, height: 48 });
}

function bake(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ add: false });
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

// Trees: `round` (leafy) and `pine`, 0 (stump) to 5 (full).
function tree(g, kind, stage) {
  const cx = 24;
  const base = 50;
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(cx + 3, base, 30, 9);
  if (stage === 0) {
    g.fillStyle(0x6b4a2b);
    g.fillEllipse(cx, base - 3, 14, 8);
    g.fillStyle(0xc9a06a);
    g.fillEllipse(cx, base - 5, 11, 5);
    g.fillStyle(0x6cae3c);
    g.fillCircle(cx + 7, base - 6, 2.5);
    return;
  }
  const f = 0.45 + stage * 0.11;
  g.fillStyle(0x5a3a22);
  g.fillRect(cx - 2.5, base - 16, 5, 14);
  if (kind === 'pine') {
    const layers = [[0x1e4a2a, 22], [0x28603a, 17], [0x3a7a44, 11]];
    layers.forEach(([col, wd], i) => {
      const top = base - 16 - (i + 1) * 11 * f;
      g.fillStyle(col);
      g.fillTriangle(cx, top - 12 * f, cx - wd * f, top + 10 * f, cx + wd * f, top + 10 * f);
    });
    g.fillStyle(0xffffff, 0.12);
    g.fillTriangle(cx, base - 16 - 45 * f, cx - 6 * f, base - 20 - 25 * f, cx, base - 20 - 25 * f);
    return;
  }
  const r = 17 * f;
  const cy = base - 16 - r * 0.7;
  g.fillStyle(0x1f4d25);
  g.fillCircle(cx, cy, r);
  g.fillCircle(cx - r * 0.7, cy + r * 0.25, r * 0.7);
  g.fillCircle(cx + r * 0.7, cy + r * 0.25, r * 0.7);
  g.fillStyle(0x2f6a34);
  g.fillCircle(cx - r * 0.25, cy - r * 0.2, r * 0.75);
  g.fillCircle(cx + r * 0.45, cy - r * 0.05, r * 0.55);
  g.fillStyle(0x4f9a4a);
  g.fillCircle(cx - r * 0.35, cy - r * 0.45, r * 0.38);
  g.fillStyle(0x8fd16a, 0.6);
  g.fillCircle(cx - r * 0.45, cy - r * 0.55, r * 0.15);
}

// Potato plants: leafy tops over a mound, potatoes showing when ripe.
function potato(g, amount) {
  g.fillStyle(0x4a321e);
  g.fillEllipse(16, 20, 26, 10);
  if (amount === 0) {
    g.fillStyle(0x7da33e);
    g.fillCircle(16, 16, 2.5);
    return;
  }
  const s = 3.5 + amount * 1.3;
  g.fillStyle(0x2f6a24);
  g.fillCircle(10, 13, s);
  g.fillCircle(22, 13, s);
  g.fillStyle(0x4f9a34);
  g.fillCircle(16, 10, s + 0.5);
  g.fillStyle(0x7cc04a);
  g.fillCircle(14, 8, s * 0.45);
  g.fillStyle(0xe0b870);
  for (let k = 0; k < amount; k++) {
    g.fillCircle(9 + k * 7, 21, 3);
    g.fillStyle(0xc9a05a);
    g.fillCircle(10 + k * 7, 22, 1);
    g.fillStyle(0xe0b870);
  }
}

export function makeTextures(scene) {
  for (let s = 0; s <= 5; s++) {
    bake(scene, `tree-round-${s}`, 48, 56, (g) => tree(g, 'round', s));
    bake(scene, `tree-pine-${s}`, 48, 56, (g) => tree(g, 'pine', s));
  }
  for (let a = 0; a <= 3; a++) bake(scene, `potato-${a}`, 32, 28, (g) => potato(g, a));
  bake(scene, 'px-dot', 8, 8, (g) => {
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(4, 4, 4);
    g.fillStyle(0xffffff);
    g.fillCircle(4, 4, 2);
  });
  bake(scene, 'px-puff', 24, 24, (g) => {
    for (let k = 5; k > 0; k--) {
      g.fillStyle(0xffffff, 0.12);
      g.fillCircle(12, 12, k * 2.4);
    }
  });
  bake(scene, 'px-leaf', 10, 6, (g) => {
    g.fillStyle(0xffffff);
    g.fillEllipse(5, 3, 10, 5);
  });
  bake(scene, 'px-chip', 4, 4, (g) => {
    g.fillStyle(0xffffff);
    g.fillRect(0, 0, 4, 4);
  });
  bake(scene, 'px-cloud', 128, 64, (g) => {
    for (let k = 6; k > 0; k--) {
      g.fillStyle(0x000000, 0.035);
      g.fillEllipse(64, 32, 20 + k * 17, 10 + k * 9);
    }
  });
  bake(scene, 'bubble', 40, 40, (g) => {
    g.fillStyle(0x000000, 0.25);
    g.fillCircle(21, 22, 17);
    g.fillStyle(0xfdf8ec);
    g.fillCircle(20, 20, 17);
    g.lineStyle(2, 0x17202e, 0.6);
    g.strokeCircle(20, 20, 17);
  });
}
