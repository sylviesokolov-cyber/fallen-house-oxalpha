import { usePower } from '../sim/godPowers.js';
import { leaderOf, leaderTitle, rankOf } from '../sim/settlement.js';
import { successorOf, spousesOf, unwed } from '../sim/dynasty.js';
import { decreeCost, puppetRuler } from '../sim/decrees.js';
import { nextUpgrade } from '../sim/construction.js';
import { isFamily } from '../sim/bonds.js';
import { lifeStage } from '../sim/lifecycle.js';
import { dateOf } from '../sim/time.js';
import { appearance } from '../render/appearance.js';
import { looksLabel } from '../sim/appeal.js';
import { $, el, button, renderKeyed } from './dom.js';
import { icon } from './icons.js';
import { portrait, royalMarks } from './portrait.js';

// The Throne: the ruling house, the ruler and their spouses, the heir and
// line of succession, and the chronicle of past reigns. Once the ruler is
// the god's puppet, this is also where decrees are made: step-by-step
// pickers for a marriage, an heir, a building or a calling.

export function createThronePanel(ctx, { toast, select }) {
  let flow = null; // { kind, step, a }

  const section = (t) => el('h3', null, t);

  function personRow(h, sub, onTap) {
    const { sim, data } = ctx;
    const stage = lifeStage(h, sim, data);
    const b = button('person with-face', '', onTap ?? (() => select(h.id)));
    const face = portrait(appearance(h, stage === 'elder', data), h, stage, true, data, royalMarks(sim, h));
    face.classList.add('mini');
    const info = el('div', 'person-info');
    const top = el('div', 'person-top');
    top.append(el('span', 'person-name', h.name), el('span', 'kind', `Lv ${h.level}`));
    info.append(top, el('div', 'person-sub', sub ?? rankOf(sim, data, h) ?? `House ${h.house}`));
    b.append(face, info);
    return b;
  }

  function decree(target, done) {
    const result = usePower(ctx.sim, ctx.data, 'decree', target);
    if (!result.ok) return toast(result.error);
    const ruler = leaderOf(ctx.sim);
    if (ruler) ctx.events.emit('power-used', { powerId: 'decree', x: ruler.x, y: ruler.y });
    toast(done);
    flow = null;
    render(true);
  }

  // Each decree is a short list to pick from.
  function flowNodes() {
    const { sim, data } = ctx;
    const ruler = leaderOf(sim);
    const adults = sim.humans.filter((h) => lifeStage(h, sim, data) !== 'child');
    const back = button('wide ghost-btn', 'Cancel', () => {
      flow = null;
      render(true);
    });
    if (flow.kind === 'wed' && !flow.a) {
      const pool = adults.filter((h) => h === ruler || unwed(sim, data, h));
      return [section('Arrange a marriage: first, who?'), ...pool.map((h) => personRow(h, h === ruler ? 'The ruler (may take another spouse)' : `${looksLabel(h)} · House ${h.house}`, () => {
        flow.a = h;
        render(true);
      })), back];
    }
    if (flow.kind === 'wed') {
      const a = flow.a;
      const pool = adults.filter((h) => h !== a && unwed(sim, data, h) && !isFamily(a, h));
      return [section(`Wed ${a.name} to…`), ...pool.map((h) => personRow(h, `${looksLabel(h)} · House ${h.house}`, () => decree({ kind: 'wed', aId: a.id, bId: h.id }, 'A marriage is decreed'))), back];
    }
    if (flow.kind === 'heir') {
      const kids = sim.humans.filter((h) => h.parents.includes(ruler.id));
      return [section('Name the heir'), ...(kids.length ? kids.map((h) => personRow(h, null, () => decree({ kind: 'heir', id: h.id }, `${h.name} is the heir`))) : [el('div', 'empty', 'The ruler has no children yet.')]), back];
    }
    if (flow.kind === 'build') {
      const known = (tech) => !tech || sim.humans.some((h) => h.knows.includes(tech));
      const rows = [];
      for (const def of data.buildings) {
        const b = sim.buildings.find((o) => o.type === def.id && o.built);
        const u = b && nextUpgrade(data, b);
        if (u && known(u.tech)) rows.push([def, `Upgrade to level ${u.level}`]);
        else if (!b && def.cost && known(def.tech) && !sim.buildings.some((o) => o.type === def.id)) rows.push([def, 'Build']);
      }
      return [section('Order a building'), ...(rows.length ? rows.map(([def, what]) => {
        const r = button('bond', '', () => decree({ kind: 'build', type: def.id }, `The ${def.name} is ordered`));
        r.append(el('span', null, def.name), el('span', 'kind', what));
        return r;
      }) : [el('div', 'empty', 'Nothing new can be built yet.')]), back];
    }
    // focus
    return [section('Proclaim a calling'), ...data.focuses.map((f) => {
      const r = button('bond omen-choice', '', () => decree({ kind: 'focus', focus: f.id }, `The people are called to ${f.name}`));
      const text = el('span', 'omen-text');
      text.append(el('strong', null, f.name), el('span', 'kind', f.description));
      r.append(text);
      return r;
    }), back];
  }

  function decreeButtons() {
    const { data } = ctx;
    const items = [['wed', 'heart', 'Arrange a marriage'], ['heir', 'crown', 'Name the heir'], ['build', 'hammer', 'Order a building'], ['focus', 'omen', 'Proclaim a calling']];
    const grid = el('div', 'decree-grid');
    for (const [kind, ic, label] of items) {
      const b = button('decree', '', () => {
        flow = { kind };
        render(true);
      });
      b.append(icon(ic), el('span', null, label), el('span', 'cost', `${decreeCost(data, kind)}`));
      b.lastChild.prepend(icon('faith', 'cost-icon'));
      grid.append(b);
    }
    return grid;
  }

  function overview() {
    const { sim, data } = ctx;
    const ruler = leaderOf(sim);
    const nodes = [];
    if (!ruler) return [el('div', 'empty', 'The throne stands empty.')];
    const dy = sim.dynasty;
    nodes.push(section(`House ${dy.house}${dy.royal ? ' · royal' : ''}`));
    nodes.push(personRow(ruler, `${leaderTitle(sim, data, ruler)} of ${sim.settlement.name}${dy.puppetId === ruler.id ? ' · your puppet' : ''}`));
    const spouses = spousesOf(sim, ruler);
    if (spouses.length) {
      nodes.push(section(spouses.length > 1 ? 'Spouses' : 'Spouse'));
      nodes.push(...spouses.map((h) => personRow(h)));
    }
    const next = successorOf(sim, data, ruler, false);
    nodes.push(section('Next in line'));
    nodes.push(next ? personRow(next.ruler, next.how === 'heir' ? 'Named heir' : next.how === 'child' ? 'Eldest child' : 'Sibling') : el('div', 'empty', 'No heir of the blood. The people would choose.'));
    const kids = sim.humans.filter((h) => h.parents.includes(ruler.id) && h !== next?.ruler);
    if (kids.length) {
      nodes.push(section('Children of the ruler'));
      nodes.push(...kids.map((h) => personRow(h)));
    }
    // The god's hand.
    if (puppetRuler(sim)) {
      nodes.push(section('Decrees'), el('div', 'sub', `${ruler.name} hears your voice and will proclaim whatever you decree.`), decreeButtons());
    } else {
      const cost = data.powersById.puppet.cost;
      const b = button('wide puppet-btn', '', () => {
        const result = usePower(sim, data, 'puppet', { humanId: ruler.id });
        if (!result.ok) return toast(result.error);
        ctx.events.emit('power-used', { powerId: 'puppet', x: result.x, y: result.y });
        toast(`${ruler.name} now hears your voice`);
        render(true);
      });
      b.append(icon('crown'), el('span', null, `Make ${ruler.name} your puppet`), el('span', 'cost', `${cost}`));
      b.lastChild.prepend(icon('faith', 'cost-icon'));
      nodes.push(section('The god’s hand'), el('div', 'sub', 'A puppet ruler lets you arrange marriages, name the heir, order buildings and proclaim callings.'), b);
    }
    nodes.push(section('Chronicle of rulers'));
    for (const r of [...dy.rulers].reverse()) {
      const from = dateOf(r.from, data.config.time).year;
      const to = r.to == null ? 'now' : `Year ${dateOf(r.to, data.config.time).year}`;
      const row = el('div', 'kv');
      row.append(el('span', null, `${r.name} of ${r.house}`), el('span', 'kind', `Year ${from} – ${to}`));
      nodes.push(row);
    }
    return nodes;
  }

  function render(force = false) {
    const { sim } = ctx;
    const ruler = leaderOf(sim);
    $('throne-sub').textContent = ruler ? `${leaderTitle(sim, ctx.data, ruler)} ${ruler.name} of House ${ruler.house}` : 'No ruler';
    const key = `${JSON.stringify(sim.dynasty)}|${ruler?.consorts}|${ruler?.partnerId}|${sim.humans.length}|${flow?.kind}|${flow?.a?.id}|${Math.floor(sim.faith / 10)}`;
    if (force) $('throne-body').dataset.key = '';
    renderKeyed($('throne-body'), key, () => (flow ? flowNodes() : overview()));
  }

  return {
    render,
    reset() {
      flow = null;
    },
  };
}
