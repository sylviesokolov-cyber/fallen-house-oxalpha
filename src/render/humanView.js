import { TILE_SIZE, hexToInt } from './constants.js';
import { lifeStage } from '../sim/lifecycle.js';
import { appearance } from './appearance.js';

const CARRY_COLORS = { wood: hexToInt('#7a5230'), food: hexToInt('#c9a35a') };
const WORK = new Set(['gather', 'harvest', 'build', 'craft', 'train', 'arcane']);

// The weapon at their side, drawn around the hand.
function drawGear(g, gear) {
  g.clear();
  if (gear === 'sword') {
    g.fillStyle(0xd8dde6).fillRect(5, -6, 1.4, 9);
    g.fillStyle(0x6b4a2b).fillRect(3.8, 2.4, 3.8, 1.2);
  } else if (gear === 'bow') {
    g.lineStyle(1.2, 0x8a5a2b).beginPath().arc(4, 1, 5, -1.2, 1.2).strokePath();
    g.lineStyle(0.6, 0xeeeeee).lineBetween(5.8, -3.6, 5.8, 5.6);
  } else if (gear === 'staff') {
    g.lineStyle(1.4, 0x7a5230).lineBetween(6, -7, 6, 7);
    g.fillStyle(0xb48cff).fillCircle(6, -8, 1.8);
  }
}

// Each person is a little figure: shadow, tunic (coloured by what they do
// best, outlined in their grade colour, built slim or broad by strength) with
// a sash in their house colour, head, hair style, beard and the weapon they
// carry. The ageless wear a halo and the sick look pale. Positions are
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
    const bun = add.circle(0, -8.6, 1.8, 0x000000);
    const spikes = add.triangle(0, -8.5, -3.5, 2.5, 3.5, 2.5, 0, -2, 0x000000);
    const beard = add.ellipse(0, -1.6, 5.4, 3.4, 0x000000);
    const sash = add.rectangle(0, 2, 2.2, 11, 0xffffff).setAngle(-35);
    const halo = add.ellipse(0, -10, 8, 2.6).setStrokeStyle(1, 0xffe27a, 0.95).setVisible(false);
    const gear = add.graphics();
    const zzz = add.text(4, -18, 'z', { fontSize: '10px', fontStyle: 'bold', color: '#ffffff', stroke: '#1b1b1b', strokeThickness: 2 })
      .setResolution(3)
      .setVisible(false);
    const carry = add.rectangle(0, -13, 5, 5, 0xffffff).setStrokeStyle(1, 0x1b1b1b).setVisible(false);
    const talk = add.text(-6, -22, '…', { fontSize: '11px', fontStyle: 'bold', color: '#ffffff', stroke: '#1b1b1b', strokeThickness: 2 })
      .setResolution(3)
      .setVisible(false);
    const crown = add.triangle(0, -12, -4, 2, 4, 2, 0, -4, 0xffd35c).setStrokeStyle(0.8, 0x7a5a10).setVisible(false);
    const figure = add.container(0, 0, [gear, hairBack, body, sash, head, beard, hair, bun, spikes, halo]);
    const c = add.container(0, 0, [shadow, figure, zzz, carry, talk, crown]).setDepth(3);
    Object.assign(c, { figure, body, head, hair, hairBack, bun, spikes, beard, sash, halo, gear, crown, zzz, carry, talk, look: null, phase: Math.random() * 6 });
    this.sprites.set(h.id, c);
    return c;
  }

  // Redrawn only when something about their look changes.
  restyle(s, h, stage, data) {
    const look = appearance(h, stage === 'elder', data);
    const key = `${JSON.stringify(look)}|${stage}|${h.grade}|${h.eternal}|${!!h.sick}`;
    if (key === s.look) return;
    s.look = key;
    const hair = hexToInt(look.hair);
    const child = stage === 'child';
    s.body.setFillStyle(hexToInt(look.tunic)).setStrokeStyle(h.grade >= 2 ? 1.6 : 1, h.grade >= 2 ? hexToInt(this.gradeColors[h.grade - 1]) : 0x1b1b1b);
    s.body.setScale(look.build === 'broad' ? 1.18 : look.build === 'slim' ? 0.86 : 1, 1);
    s.head.setFillStyle(h.sick ? 0xb9d39a : hexToInt(look.skin));
    s.hair.setFillStyle(hair).setVisible(look.hairStyle !== 'bald');
    s.hairBack.setFillStyle(hair).setVisible(look.longHair);
    s.bun.setFillStyle(hair).setVisible(look.hairStyle === 'bun');
    s.spikes.setFillStyle(hair).setVisible(look.hairStyle === 'spiky');
    s.beard.setFillStyle(hair).setVisible(look.beard && !child);
    s.sash.setFillStyle(look.sash ? hexToInt(look.sash) : 0).setVisible(!!look.sash && !child);
    s.halo.setVisible(!!h.eternal);
    drawGear(s.gear, child ? null : look.gear);
    s.figure.setScale(child ? 0.7 : 1);
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
      // A rhythmic swing while working, a slow breath when standing still.
      const now = this.scene.time.now / 1000 + s.phase;
      const working = WORK.has(h.action.type) && !h.action.path?.length && h.action.ticks != null;
      const swing = working ? Math.sin(now * 9) * 12 : 0;
      s.gear.setAngle(swing * 2);
      s.figure.setY(bob + (working ? -Math.abs(Math.sin(now * 9)) * 1 : 0)).setAngle(asleep ? 90 : swing * 0.3);
      if (!moving && !asleep) s.body.scaleY = 1 + Math.sin(now * 2.2) * 0.04;
      if (moving && h.x !== h.prevX) s.figure.setScale(Math.abs(s.figure.scaleX) * (h.x < h.prevX ? -1 : 1), s.figure.scaleY);
      s.zzz.setVisible(asleep);
      s.talk.setVisible(h.action.type === 'chat' || h.action.type === 'drink');
      this.restyle(s, h, lifeStage(h, sim, data), data);
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
