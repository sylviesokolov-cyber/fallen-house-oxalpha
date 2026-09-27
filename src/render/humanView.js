import { TILE_SIZE, hexToInt } from './constants.js';
import { lifeStage } from '../sim/lifecycle.js';
import { appearance } from './appearance.js';

const CARRY_COLORS = { wood: hexToInt('#7a5230'), food: hexToInt('#c9a35a') };

// Each person is a little figure: shadow, tunic (coloured by what they do
// best, outlined in their grade colour), head and hair. Positions are
// interpolated between the previous and current tile so movement is smooth
// at any tick rate, with a small bob while walking. Sleepers lie down.
export class HumanView {
  constructor(scene) {
    this.scene = scene;
    this.sprites = new Map();
    this.ring = scene.add.ellipse(0, 5, 18, 8).setStrokeStyle(2, 0xffe066).setDepth(2.9).setVisible(false);
  }

  create(h) {
    const add = this.scene.add;
    const shadow = add.ellipse(0, 6, 10, 4, 0x000000, 0.28);
    const hairBack = add.ellipse(0, -2.5, 8.6, 8, 0x000000);
    const body = add.ellipse(0, 2, 10, 10, 0xffffff);
    const head = add.circle(0, -4, 3.6, 0xffffff).setStrokeStyle(0.8, 0x1b1b1b, 0.6);
    const hair = add.arc(0, -4.6, 3.9, 180, 360, false, 0x000000);
    const zzz = add.text(4, -18, 'z', { fontSize: '10px', fontStyle: 'bold', color: '#ffffff', stroke: '#1b1b1b', strokeThickness: 2 })
      .setResolution(3)
      .setVisible(false);
    const carry = add.rectangle(0, -13, 5, 5, 0xffffff).setStrokeStyle(1, 0x1b1b1b).setVisible(false);
    const talk = add.text(-6, -22, '…', { fontSize: '11px', fontStyle: 'bold', color: '#ffffff', stroke: '#1b1b1b', strokeThickness: 2 })
      .setResolution(3)
      .setVisible(false);
    const crown = add.triangle(0, -12, -4, 2, 4, 2, 0, -4, 0xffd35c).setStrokeStyle(0.8, 0x7a5a10).setVisible(false);
    const figure = add.container(0, 0, [hairBack, body, head, hair]);
    const c = add.container(0, 0, [shadow, figure, zzz, carry, talk, crown]).setDepth(3);
    Object.assign(c, { figure, body, head, hair, hairBack, crown, zzz, carry, talk, look: null });
    this.sprites.set(h.id, c);
    return c;
  }

  // Colours only change when the person's class, stage or grade does.
  restyle(s, h, stage) {
    const look = appearance(h, stage === 'elder');
    const key = `${look.tunic}|${look.hair}|${stage}|${h.grade}`;
    if (key === s.look) return;
    s.look = key;
    s.body.setFillStyle(hexToInt(look.tunic)).setStrokeStyle(h.grade >= 2 ? 1.6 : 1, h.grade >= 2 ? hexToInt(this.gradeColors[h.grade - 1]) : 0x1b1b1b);
    s.head.setFillStyle(hexToInt(look.skin));
    s.hair.setFillStyle(hexToInt(look.hair));
    s.hairBack.setFillStyle(hexToInt(look.hair)).setVisible(look.longHair);
    s.figure.setScale(stage === 'child' ? 0.7 : 1);
  }

  update(sim, data, alpha, selectedId) {
    this.gradeColors ??= data.grades.map((g) => g.color);
    const moveTicks = data.config.humans.moveTicks;
    const alive = new Set();
    for (const h of sim.humans) {
      alive.add(h.id);
      const s = this.sprites.get(h.id) ?? this.create(h);
      // Heroes in the dungeon aren't on the map.
      s.setVisible(h.away == null);
      if (h.away != null) continue;
      const t = Math.min(1, Math.max(0, (sim.tick - h.stepTick + alpha) / (h.stepTicks ?? moveTicks)));
      const moving = t < 1 && (h.x !== h.prevX || h.y !== h.prevY);
      const bob = moving ? -Math.abs(Math.sin(t * Math.PI)) * 1.6 : 0;
      s.setPosition((h.prevX + (h.x - h.prevX) * t + 0.5) * TILE_SIZE, (h.prevY + (h.y - h.prevY) * t + 0.5) * TILE_SIZE);
      const asleep = h.action.type === 'sleep' || h.action.type === 'recover';
      s.figure.setY(bob).setAngle(asleep ? 90 : 0);
      if (moving && h.x !== h.prevX) s.figure.setScale(Math.abs(s.figure.scaleX) * (h.x < h.prevX ? -1 : 1), s.figure.scaleY);
      s.zzz.setVisible(asleep);
      s.talk.setVisible(h.action.type === 'chat' || h.action.type === 'drink');
      this.restyle(s, h, lifeStage(h, sim, data));
      s.crown.setVisible(sim.settlement.leaderId === h.id && !h.carrying && !asleep);
      s.carry.setVisible(!!h.carrying);
      if (h.carrying) s.carry.setFillStyle(CARRY_COLORS[h.carrying.type] ?? 0xffffff);
    }
    for (const [id, s] of this.sprites) {
      if (!alive.has(id)) {
        s.destroy();
        this.sprites.delete(id);
      }
    }
    const sel = this.sprites.get(selectedId);
    this.ring.setVisible(!!sel && sel.visible);
    if (sel) this.ring.setPosition(sel.x, sel.y + 5);
  }

  humanAt(wx, wy, radius) {
    let bestId = null;
    let bestD = radius * radius;
    for (const [id, s] of this.sprites) {
      if (!s.visible) continue;
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
