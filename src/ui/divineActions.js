import { usePower } from '../sim/godPowers.js';
import { $, el, button, renderKeyed } from './dom.js';
import { icon } from './icons.js';
import { haptic } from './sheets.js';

// The god's hand on one person, from their character sheet: Bless, Inspire,
// Gift (a talent or knowledge, chosen from a list), Eternal youth, and, for
// the ruler, making them a puppet.

const ACTIONS = ['bless', 'inspire', 'gift', 'eternity', 'puppet'];

export function createDivineActions(ctx, { toast }) {
  let giftFor = null;

  function use(powerId, target) {
    const { sim, data } = ctx;
    const result = usePower(sim, data, powerId, target);
    if (!result.ok) return toast(result.error);
    haptic([15, 30, 15]);
    ctx.events.emit('power-used', { powerId: powerId === 'bless' || powerId === 'inspire' ? powerId : 'bless', x: result.x, y: result.y });
    toast(`${data.powersById[powerId].name}: done`);
    giftFor = null;
  }

  function actionButton(h, powerId) {
    const { sim, data } = ctx;
    const p = data.powersById[powerId];
    const b = button('divine', '', () => {
      if (powerId === 'gift') {
        giftFor = giftFor === h.id ? null : h.id;
        return render(h, true);
      }
      use(powerId, { humanId: h.id });
    });
    b.classList.toggle('poor', sim.faith < p.cost);
    b.classList.toggle('open', powerId === 'gift' && giftFor === h.id);
    b.append(icon(p.icon ?? powerId), el('span', 'divine-name', p.name), el('span', 'cost', `${p.cost}`));
    return b;
  }

  // Talents (+levels to a skill) and knowledge the tribe has had.
  function giftList(h) {
    const { sim, data } = ctx;
    const levels = data.powersById.gift.levels;
    const nodes = [el('h3', null, 'Give a talent')];
    const skills = el('div', 'gift-grid');
    for (const s of data.skills) {
      const lv = h.skills[s.id]?.level ?? 0;
      const b = button('chip', `${s.name} ${lv}→${lv + levels}`, () => use('gift', { humanId: h.id, skill: s.id }));
      skills.append(b);
    }
    nodes.push(skills, el('h3', null, 'Give knowledge'));
    const techs = data.techs.filter((t) => sim.discoveries[t.id] && !h.knows.includes(t.id));
    const known = el('div', 'gift-grid');
    for (const t of techs) {
      const b = button(`chip tech${sim.discoveries[t.id].lost ? ' lost' : ''}`, sim.discoveries[t.id].lost ? `${t.name} (lost)` : t.name,
        () => use('gift', { humanId: h.id, tech: t.id }));
      known.append(b);
    }
    nodes.push(techs.length ? known : el('div', 'empty', 'They know everything the tribe has found.'));
    return nodes;
  }

  function render(h, force = false) {
    const { sim } = ctx;
    const isRuler = sim.settlement.leaderId === h.id;
    const shown = ACTIONS.filter((a) => (a !== 'puppet' || (isRuler && sim.dynasty.puppetId !== h.id)) && (a !== 'eternity' || !h.eternal));
    const key = `${h.id}|${shown}|${giftFor === h.id}|${Math.floor(sim.faith / 10)}|${h.eternal}`;
    if (force) $('insp-divine').dataset.key = '';
    renderKeyed($('insp-divine'), key, () => {
      const row = el('div', 'divine-row');
      row.append(...shown.map((a) => actionButton(h, a)));
      return giftFor === h.id ? [row, ...giftList(h)] : [row];
    });
  }

  return { render };
}
