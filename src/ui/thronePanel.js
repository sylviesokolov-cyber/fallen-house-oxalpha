import { usePower } from '../sim/godPowers.js';
import { leaderOf, leaderTitle, rankOf } from '../sim/settlement.js';
import { royalLine, successorOf, spousesOf, unwed } from '../sim/dynasty.js';
import { decreeCost, puppetRuler } from '../sim/decrees.js';
import { lawLevel } from '../sim/crime.js';
import { rulerLine } from './familyTree.js';
import { shareChronicle } from './chronicleCard.js';
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
    const face = portrait(appearance(h, stage === 'elder', data), h, stage, true, data, royalMarks(sim, h, data));
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
      const pool = adults.filter((h) => (h === ruler && (h.sex === 'male' || h.partnerId == null)) || unwed(sim, data, h));
      const rulerNote = ruler.sex === 'male' ? 'The ruler (may take another wife)' : 'The heiress (her husband will be King)';
      return [section('Arrange a marriage: first, who?'), ...pool.map((h) => personRow(h, h === ruler ? rulerNote : `${looksLabel(h)} · House ${h.house}`, () => {
        flow.a = h;
        render(true);
      })), back];
    }
    if (flow.kind === 'wed') {
      const a = flow.a;
      const pool = adults.filter((h) => h !== a && h.sex !== a.sex && unwed(sim, data, h) && !isFamily(a, h));
      return [section(`Wed ${a.name} to…`), ...pool.map((h) => personRow(h, `${looksLabel(h)} · House ${h.house}`, () => decree({ kind: 'wed', aId: a.id, bId: h.id }, 'A marriage is decreed'))), back];
    }
    if (flow.kind === 'heir') {
      const line = royalLine(sim, ruler);
      const kids = sim.humans.filter((h) => h.parents.includes(line.id));
      return [section(`Name the heir among the children of ${line.name}`), ...(kids.length ? kids.map((h) => personRow(h, null, () => decree({ kind: 'heir', id: h.id }, `${h.name} is the heir`))) : [el('div', 'empty', 'The royal line has no children yet.')]), back];
    }
    if (flow.kind === 'build') {
      const known = (tech) => !tech || sim.humans.some((h) => h.knows.includes(tech));
      const rows = [];
      for (const def of data.buildings) {
        const b = sim.buildings.find((o) => o.type === def.id && o.built);
        const u = b && nextUpgrade(data, b);
        if (u && known(u.tech)) rows.push([def, `Upgrade to level ${u.level}`]);
        else if (!b && def.cost && (def.tier ?? 1) <= (sim.settlement.tier ?? 1) && known(def.tech) && !sim.buildings.some((o) => o.type === def.id)) rows.push([def, 'Build']);
      }
      return [section('Order a building'), ...(rows.length ? rows.map(([def, what]) => {
        const r = button('bond', '', () => decree({ kind: 'build', type: def.id }, `The ${def.name} is ordered`));
        r.append(el('span', null, def.name), el('span', 'kind', what));
        return r;
      }) : [el('div', 'empty', 'Nothing new can be built yet.')]), back];
    }
    if (flow.kind === 'law') {
      const LAWS = [
        ['lenient', 'Lenient', 'Fines and shame. People are happier, but more are tempted.'],
        ['fair', 'Fair', 'The stocks for a day; exile for those who never stop.'],
        ['harsh', 'Harsh', 'Flogging, the cells, quick exile. Few dare, but everyone lives in fear.'],
      ];
      const now = lawLevel(sim, data);
      return [section('Set the law of the land'), ...LAWS.map(([id, name, text]) => {
        const r = button(`bond omen-choice${id === now ? ' chosen' : ''}`, '', () => decree({ kind: 'law', level: id }, `The law is now ${name.toLowerCase()}`));
        const t = el('span', 'omen-text');
        t.append(el('strong', null, `${name}${id === now ? ' (now)' : ''}`), el('span', 'kind', text));
        r.append(t);
        return r;
      }), back];
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
    const items = [['wed', 'heart', 'Arrange a marriage'], ['heir', 'crown', 'Name the heir'], ['build', 'hammer', 'Order a building'], ['focus', 'omen', 'Proclaim a calling'], ['law', 'shield', 'Set the law']];
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
    const next = successorOf(sim, data, ruler);
    nodes.push(section('Next in line'));
    const HOW = { heir: 'Named heir', child: 'Eldest son', sibling: 'Brother', widow: 'The heiress herself' };
    if (!next) nodes.push(el('div', 'empty', 'No heir of the blood. The people would choose.'));
    else if (next.heiress && next.ruler !== next.heiress) {
      nodes.push(personRow(next.heiress, `Heiress (${next.via === 'sibling' ? 'sister' : next.via === 'widow' ? 'the widowed heiress' : 'eldest daughter'})`));
      nodes.push(personRow(next.ruler, 'Her husband, who would be King'));
    } else if (next.heiress) nodes.push(personRow(next.ruler, next.how === 'widow' ? 'The widowed heiress, until she weds' : 'Heiress: would hold the throne until she weds'));
    else nodes.push(personRow(next.ruler, HOW[next.how] ?? 'Next in line'));
    const line = royalLine(sim, ruler);
    const kids = sim.humans.filter((h) => h.parents.includes(line.id) && h !== next?.ruler && h !== next?.heiress);
    if (line !== ruler) nodes.push(el('div', 'sub', `The crown runs through ${line.name}: only her children may inherit.`));
    if (kids.length) {
      nodes.push(section(line === ruler ? 'Children of the ruler' : `Children of ${line.name}`));
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
    nodes.push(section('The line of rulers'), rulerLine(ctx, select));
    const share = button('wide share-btn', '', () => shareChronicle(ctx, toast));
    share.append(icon('log'), el('span', null, 'Share the chronicle'));
    nodes.push(share);
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
