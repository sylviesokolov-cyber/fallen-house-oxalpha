import { TILE_SIZE, hexToInt } from './constants.js';
import { lifeStage } from '../sim/lifecycle.js';

const COLORS = { female: 0xf4a6c4, male: 0x86b8ff };
const CARRY_COLORS = { wood: hexToInt('#7a5230'), stone: hexToInt('#c9c9c2') };

// One small container per human. Positions are interpolated between the
// previous and current tile so movement looks smooth at any tick rate.
export class HumanView {
  constructor(scene) {
    this.scene = scene;
    this.sprites = new Map();
    this.ring = scene.add.circle(0, 0, 9).setStrokeStyle(2, 0xffe066).setDepth(4).setVisible(false);
  }

  create(h) {
    const body = this.scene.add.circle(0, 0, 5, COLORS[h.sex]).setStrokeStyle(1.5, 0x1b1b1b);
    const zzz = this.scene.add.text(3, -15, 'z', { fontSize: '10px', fontStyle: 'bold', color: '#ffffff' })
      .setResolution(3)
      .setVisible(false);
    const carry = this.scene.add.rectangle(0, -12, 5, 5, 0xffffff).setStrokeStyle(1, 0x1b1b1b).setVisible(false);
    const talk = this.scene.add.text(-5, -19, '…', { fontSize: '11px', fontStyle: 'bold', color: '#ffffff' })
      .setResolution(3)
      .setVisible(false);
    const c = this.scene.add.container(0, 0, [body, zzz, carry, talk]).setDepth(3);
    c.body = body;
    c.zzz = zzz;
    c.carry = carry;
    c.talk = talk;
    c.stage = null;
    this.sprites.set(h.id, c);
    return c;
  }

  update(sim, data, alpha, selectedId) {
    const moveTicks = data.config.humans.moveTicks;
    const alive = new Set();
    for (const h of sim.humans) {
      alive.add(h.id);
      const s = this.sprites.get(h.id) ?? this.create(h);
      const t = Math.min(1, Math.max(0, (sim.tick - h.stepTick + alpha) / (h.stepTicks ?? moveTicks)));
      s.setPosition((h.prevX + (h.x - h.prevX) * t + 0.5) * TILE_SIZE, (h.prevY + (h.y - h.prevY) * t + 0.5) * TILE_SIZE);
      s.zzz.setVisible(h.action.type === 'sleep');
      s.talk.setVisible(h.action.type === 'chat');
      const stage = lifeStage(h, sim, data);
      if (stage !== s.stage) {
        s.stage = stage;
        s.body.setScale(stage === 'child' ? 0.65 : 1);
        s.body.setStrokeStyle(1.5, stage === 'elder' ? 0xdddddd : 0x1b1b1b);
      }
      s.carry.setVisible(!!h.carrying);
      if (h.carrying) s.carry.setFillStyle(CARRY_COLORS[h.carrying.type]);
    }
    for (const [id, s] of this.sprites) {
      if (!alive.has(id)) {
        s.destroy();
        this.sprites.delete(id);
      }
    }
    const sel = this.sprites.get(selectedId);
    this.ring.setVisible(!!sel);
    if (sel) this.ring.setPosition(sel.x, sel.y);
  }

  humanAt(wx, wy, radius) {
    let bestId = null;
    let bestD = radius * radius;
    for (const [id, s] of this.sprites) {
      const d = (s.x - wx) ** 2 + (s.y - wy) ** 2;
      if (d <= bestD) {
        bestD = d;
        bestId = id;
      }
    }
    return bestId;
  }

  destroy() {
    for (const s of this.sprites.values()) s.destroy();
    this.sprites.clear();
    this.ring.destroy();
  }
}
