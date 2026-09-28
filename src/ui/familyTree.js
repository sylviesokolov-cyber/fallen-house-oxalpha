import { appearance, houseColor } from '../render/appearance.js';
import { lifeStage } from '../sim/lifecycle.js';
import { spousesOf } from '../sim/dynasty.js';
import { dateOf } from '../sim/time.js';
import { el, button } from './dom.js';
import { portrait, royalMarks } from './portrait.js';

// Family, drawn as a little tree: parents above, the person with their
// spouses, then siblings, and children below. Everyone is tappable, the
// dead included (greyed). Also the line of rulers for the Throne sheet.

const find = (sim, id) => sim.humans.find((h) => h.id === id) ?? sim.dead.find((h) => h.id === id);

function face(ctx, h, onTap, sub = '') {
  const { sim, data } = ctx;
  const alive = sim.humans.includes(h);
  const stage = alive ? lifeStage(h, sim, data) : 'adult';
  const b = button(`kin${alive ? '' : ' gone'}`, '', onTap);
  let pic;
  try {
    pic = portrait(appearance(h, stage === 'elder', data), h, stage, alive, data, alive ? royalMarks(sim, h) : {});
  } catch {
    pic = el('div', 'portrait-frame');
  }
  pic.classList.add('mini');
  if (h.house) b.style.setProperty('--house', houseColor(h.house));
  b.append(pic, el('span', 'kin-name', h.name), el('span', 'kin-sub', sub || (alive ? '' : 'died')));
  return b;
}

function tier(label, people) {
  const row = el('div', 'kin-row');
  row.append(...people);
  const wrap = el('div', 'kin-tier');
  wrap.append(el('div', 'kin-label', label), row);
  return wrap;
}

export function familyTree(ctx, h, select) {
  const { sim } = ctx;
  const parents = (h.parents ?? []).map((id) => find(sim, id)).filter(Boolean);
  const siblings = sim.humans.filter((o) => o.id !== h.id && h.parents?.length && o.parents.some((p) => h.parents.includes(p)));
  const spouses = sim.humans.includes(h) ? spousesOf(sim, h) : [];
  const children = [...sim.humans, ...sim.dead].filter((o) => o.parents?.includes(h.id));
  const grandkids = sim.humans.filter((o) => o.parents.some((p) => children.some((c) => c.id === p))).length;
  const tap = (o) => () => select(o.id);
  const nodes = [];
  if (parents.length) nodes.push(tier('Parents', parents.map((o) => face(ctx, o, tap(o)))));
  const middle = [face(ctx, h, () => {}, h.house ? `House ${h.house}` : ''), ...spouses.map((o) => face(ctx, o, tap(o), o.sex === 'female' ? 'wife' : 'husband'))];
  nodes.push(tier(spouses.length ? 'Married to' : '', middle));
  if (siblings.length) nodes.push(tier('Brothers and sisters', siblings.map((o) => face(ctx, o, tap(o)))));
  if (children.length) nodes.push(tier(`Children${grandkids ? ` · ${grandkids} grandchild${grandkids > 1 ? 'ren' : ''}` : ''}`, children.map((o) => face(ctx, o, tap(o)))));
  const tree = el('div', 'kin-tree');
  tree.append(...nodes);
  return tree;
}

// The rulers, oldest first, as a line of descent.
export function rulerLine(ctx, select) {
  const { sim, data } = ctx;
  const line = el('div', 'ruler-line');
  for (const r of sim.dynasty.rulers) {
    const h = find(sim, r.id);
    const from = dateOf(r.from, data.config.time).year;
    const to = r.to == null ? 'now' : dateOf(r.to, data.config.time).year;
    const node = h ? face(ctx, h, () => select(h.id), `Year ${from}–${to}`) : el('div', 'kin', r.name);
    const how = { child: 'son', heir: 'heir', sibling: 'brother', marriage: 'by marriage', chosen: 'chosen', widow: 'heiress' }[r.how] ?? r.how;
    const step = el('div', 'ruler-step');
    step.append(node, el('span', 'ruler-how', how));
    line.append(step);
  }
  return line;
}
