import { stepSim } from './sim/sim.js';

const MAX_STEPS_PER_FRAME = 10;
const MAX_FRAME_MS = 250; // ignore long gaps, e.g. after the tab was in the background

// Fixed-timestep loop: real time accumulates, and the sim advances in whole
// ticks. `alpha` (0..1) is how far we are into the next tick, which the
// renderer uses to interpolate movement.
export class SimRunner {
  constructor(ctx) {
    this.ctx = ctx;
    this.speed = 1;
    this.acc = 0;
  }

  get tickMs() {
    return 1000 / this.ctx.data.config.time.ticksPerSecond;
  }

  get alpha() {
    return Math.min(1, this.acc / this.tickMs);
  }

  update(deltaMs) {
    if (this.speed === 0) return;
    this.acc += Math.min(deltaMs, MAX_FRAME_MS) * this.speed;
    let steps = 0;
    while (this.acc >= this.tickMs && steps < MAX_STEPS_PER_FRAME) {
      stepSim(this.ctx.sim, this.ctx.data);
      this.acc -= this.tickMs;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.acc = 0;
  }

  reset() {
    this.acc = 0;
  }
}
