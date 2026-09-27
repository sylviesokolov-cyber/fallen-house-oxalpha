import { DATA_FILES, prepareData } from '../sim/data.js';
import { createSim } from '../sim/sim.js';
import { SimRunner } from '../runner.js';
import { preloadIcons } from '../render/textures.js';
import { loadFrom } from '../ui/saves.js';

// The autosave, or null if there's none (or it's from an older version).
function resumeAutosave() {
  try {
    return loadFrom('auto');
  } catch {
    return null;
  }
}

// Loads JSON content, creates a fresh world, then hands off to WorldScene.
export class BootScene extends Phaser.Scene {
  constructor(ctx) {
    super('Boot');
    this.ctx = ctx;
  }

  preload() {
    for (const name of DATA_FILES) this.load.json(name, `data/${name}.json`);
    preloadIcons(this);
  }

  create() {
    const raw = Object.fromEntries(DATA_FILES.map((n) => [n, this.cache.json.get(n)]));
    this.ctx.data = prepareData(raw);
    const saved = this.ctx.resume && resumeAutosave();
    this.ctx.resumed = !!saved;
    this.ctx.sim = saved || createSim(this.ctx.data, this.ctx.seed);
    this.ctx.runner = new SimRunner(this.ctx);
    this.scene.start('World');
  }
}
