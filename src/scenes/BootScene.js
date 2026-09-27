import { DATA_FILES, prepareData } from '../sim/data.js';
import { createSim } from '../sim/sim.js';
import { SimRunner } from '../runner.js';
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
    this.add.text(16, 80, 'Loading...', { fontSize: '18px', color: '#ffffff' });
    for (const name of DATA_FILES) this.load.json(name, `data/${name}.json`);
  }

  create() {
    const raw = Object.fromEntries(DATA_FILES.map((n) => [n, this.cache.json.get(n)]));
    this.ctx.data = prepareData(raw);
    this.ctx.sim = (this.ctx.resume && resumeAutosave()) || createSim(this.ctx.data, this.ctx.seed);
    this.ctx.runner = new SimRunner(this.ctx);
    this.scene.start('World');
  }
}
