import { TILE_SIZE } from './constants.js';

const px = TILE_SIZE;
const SHOW_ZOOM = 1.9; // activity bubbles only once zoomed in enough to read them
const FONT = 'Nunito, system-ui, sans-serif';

// Which icon shows what someone is doing.
function activityIcon(sim, data, h) {
  const a = h.action;
  switch (a.type) {
    case 'build': return 'hammer';
    case 'craft': {
      const item = data.itemsById[a.itemId];
      if (item.kind === 'meal') return 'meal';
      if (item.kind === 'drink') return 'ale';
      if (item.kind === 'medicine') return 'remedy';
      if (item.station === 'blacksmith') return 'ore';
      if (item.station === 'mage_tower') return 'magic';
      return 'hammer';
    }
    case 'harvest': {
      const r = sim.world.resources.find((o) => o.id === a.targetId);
      return r?.type === 'tree' ? 'wood' : 'potato';
    }
    case 'train': return 'sword';
    case 'study': return 'book';
    case 'pray': return 'faith';
    case 'drink': return 'ale';
    case 'eat': return 'meal';
    case 'recover': return 'remedy';
    case 'punished': return 'shield';
    case 'arcane': return 'magic';
    case 'chat': return 'heart';
    case 'toPortal':
    case 'atPortal': return 'portal';
    default: return null;
  }
}

// Speech-bubble icons over people's heads (when zoomed in), the selected
// person's name, and little celebrations that float up: level-ups,
// discoveries, new couples, newborns.
export class BubbleView {
  constructor(scene) {
    this.scene = scene;
    this.bubbles = new Map();
    this.seen = new Map();
    this.name = scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '11px', fontStyle: '900', color: '#ffe9a8', stroke: '#0b0f18', strokeThickness: 4 })
      .setOrigin(0.5, 1).setResolution(3).setDepth(4.6).setVisible(false);
  }

  update(sim, data, sprites, selectedId) {
    const zoom = this.scene.cameras.main.zoom;
    const inv = 1 / zoom;
    const show = zoom >= SHOW_ZOOM;
    const alive = new Set();
    for (const h of sim.humans) {
      alive.add(h.id);
      const s = sprites.get(h.id);
      this.celebrate(h, s);
      const iconName = show && s?.visible ? activityIcon(sim, data, h) : null;
      let b = this.bubbles.get(h.id);
      if (!iconName) {
        if (b) b.setVisible(false);
        continue;
      }
      if (!b) {
        const bg = this.scene.add.image(0, 0, 'bubble').setScale(0.5);
        const ic = this.scene.add.image(0, -0.5, `ic-${iconName}`).setScale(0.3);
        b = this.scene.add.container(0, 0, [bg, ic]).setDepth(4.5);
        b.ic = ic;
        this.bubbles.set(h.id, b);
      }
      if (b.ic.texture.key !== `ic-${iconName}`) b.ic.setTexture(`ic-${iconName}`);
      b.setVisible(true).setScale(Math.max(0.35, 1.3 * inv)).setPosition(s.x + 7, s.y - 14 - 6 * inv);
    }
    for (const [id, b] of this.bubbles) {
      if (!alive.has(id)) {
        b.destroy();
        this.bubbles.delete(id);
      }
    }
    const sel = sprites.get(selectedId);
    const who = sel?.visible && sim.humans.find((o) => o.id === selectedId);
    this.name.setVisible(!!who);
    if (who) {
      if (this.name.text !== who.name) this.name.setText(who.name);
      this.name.setScale(Math.max(0.5, 1.4 * inv)).setPosition(sel.x, sel.y - 16 - 14 * inv);
    }
  }

  // Compares each person with how they were last frame.
  celebrate(h, s) {
    const prev = this.seen.get(h.id);
    const now = { level: h.level, story: h.story?.length ?? 0 };
    this.seen.set(h.id, now);
    if (!prev || !s?.visible) return;
    if (now.level > prev.level) this.float(s, `Level ${h.level}!`, '#ffd35c', 'sparkle');
    if (now.story > prev.story) {
      const text = h.story.at(-1).text;
      if (text.includes('discovered')) this.float(s, 'Discovery!', '#fff0a8', 'bulb');
      else if (text.includes('became partners')) this.float(s, '', '#ff9aa8', 'heart');
      else if (/ had a /.test(text)) this.float(s, 'Baby!', '#bfe0ff', 'heart');
    }
  }

  float(s, text, color, iconName) {
    const zoom = this.scene.cameras.main.zoom;
    const scale = Math.max(0.6, 1.6 / zoom);
    const parts = [];
    if (iconName) parts.push(this.scene.add.image(text ? -18 : 0, 0, `ic-${iconName}`).setScale(0.35));
    if (text) parts.push(this.scene.add.text(iconName ? 6 : 0, 0, text, { fontFamily: FONT, fontSize: '12px', fontStyle: '900', color, stroke: '#0b0f18', strokeThickness: 4 }).setOrigin(0.5).setResolution(3));
    const c = this.scene.add.container(s.x, s.y - 20, parts).setDepth(4.8).setScale(scale * 0.6);
    this.scene.tweens.add({ targets: c, y: s.y - 20 - 34 / zoom * 2, scale, duration: 400, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: c, alpha: 0, delay: 1300, duration: 500, onComplete: () => c.destroy() });
  }

  destroy() {
    for (const b of this.bubbles.values()) b.destroy();
    this.bubbles.clear();
    this.name.destroy();
  }
}
