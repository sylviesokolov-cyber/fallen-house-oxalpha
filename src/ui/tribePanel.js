import { mood } from '../sim/mood.js';
import { emotionOf } from '../sim/emotions.js';
import { gradeOf, heroClass } from '../sim/stats.js';
import { leaderOf, leaderTitle, populationCap } from '../sim/settlement.js';
import { $, el, button, stars, renderKeyed } from './dom.js';

// The Tribe tab: an overview of the settlement's progress, a roster of every
// person, the tribe's inventory, and its knowledge.

const ITEM_ROWS = [['wood', 'Wood'], ['food', 'Potatoes'], ['cooked_food', 'Meals']];

export function createTribePanel(ctx, { toast, select }) {
  let tab = 'overview';

  for (const b of document.querySelectorAll('#tribe .tabs button')) {
    b.addEventListener('click', () => {
      tab = b.dataset.tab;
      render();
    });
  }

  function section(title) {
    return el('h3', null, title);
  }

  function row(label, value, className = '') {
    const r = el('div', `kv ${className}`);
    r.append(el('span', null, label), el('span', 'kind', value));
    return r;
  }

  function overview() {
    const { sim, data } = ctx;
    const nodes = [];
    const leader = leaderOf(sim);
    if (leader) {
      const lb = button('bond', '', () => select(leader.id));
      const name = el('span', null, `${leaderTitle(sim, data, leader)} ${leader.name} `);
      name.append(stars(leader.grade, gradeOf(data, leader.grade)));
      lb.append(name, el('span', 'kind', `Lv ${leader.level}`));
      nodes.push(section('Leader'), lb);
    }

    nodes.push(section('Divine will'));
    const f = sim.focus && sim.focus.until > sim.tick ? sim.focus : null;
    if (f) {
      const days = Math.ceil((f.until - sim.tick) / data.config.time.ticksPerDay);
      nodes.push(row(data.focusesById[f.id].name, `${days} day${days === 1 ? '' : 's'} left`));
    } else {
      nodes.push(el('div', 'empty', 'No omen. Send one from the Omen power to guide the tribe.'));
    }

    nodes.push(section('The sanctuary'));
    for (const b of sim.buildings) {
      const def = data.buildingsById[b.type];
      const r = button('bond', '', () => toast(def.description));
      r.append(el('span', null, def.name), el('span', 'kind', `Lv ${b.level}`));
      nodes.push(r);
    }
    const empty = data.sanctuary.plots.length;
    nodes.push(row('Empty building plots', `${empty}`));

    const people = sim.humans;
    const avgLevel = people.length ? people.reduce((s, h) => s + h.level, 0) / people.length : 0;
    const avgMood = people.length ? people.reduce((s, h) => s + mood(h), 0) / people.length : 0;
    const emotions = {};
    for (const h of people) {
      const e = emotionOf(h, data).name;
      emotions[e] = (emotions[e] ?? 0) + 1;
    }
    nodes.push(
      section('The people'),
      row('Population', `${people.length} (beds for ${populationCap(sim, data)})`),
      row('Average level', avgLevel.toFixed(1)),
      row('Average mood', `${Math.round(avgMood)}`),
      row('Feeling', Object.entries(emotions).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || '-'),
      row('Faith', `${Math.floor(sim.faith)}`),
      row('Lives lost', `${sim.dead.length}`),
    );
    return nodes;
  }

  function people() {
    const { sim, data } = ctx;
    const sorted = [...sim.humans].sort((a, b) => b.level - a.level || b.grade - a.grade);
    return sorted.map((h) => {
      const b = button('person', '', () => select(h.id));
      const top = el('div', 'person-top');
      const name = el('span', 'person-name', `${h.name} `);
      name.append(stars(h.grade, gradeOf(data, h.grade)));
      top.append(name, el('span', 'kind', `Lv ${h.level}`));
      const e = emotionOf(h, data);
      const bottom = el('div', 'person-sub');
      const emo = el('span', null, e.name);
      emo.style.color = e.color;
      bottom.append(el('span', null, heroClass(h, data)), emo);
      b.append(top, bottom);
      return b;
    });
  }

  function items() {
    const { sim, data } = ctx;
    const nodes = [section('Stockpile')];
    for (const [key, label] of ITEM_ROWS) nodes.push(row(label, `${sim.stockpile[key] ?? 0}`));
    nodes.push(section('Tools in use'));
    const tools = {};
    for (const h of sim.humans) for (const id of Object.keys(h.tools)) tools[id] = (tools[id] ?? 0) + 1;
    const toolRows = Object.entries(tools).map(([id, n]) => row(data.itemsById[id].name, `${n}`));
    nodes.push(...(toolRows.length ? toolRows : [el('div', 'empty', 'None yet')]));
    nodes.push(section('Buildings'));
    const counts = {};
    for (const b of sim.buildings) {
      const c = (counts[b.type] ??= { built: 0, site: 0 });
      c[b.built ? 'built' : 'site']++;
    }
    const bRows = Object.entries(counts).map(([type, c]) => row(data.buildingsById[type].name, `${c.built}${c.site ? ` (+${c.site} going up)` : ''}`));
    nodes.push(...(bRows.length ? bRows : [el('div', 'empty', 'None yet')]));
    return nodes;
  }

  // Discovered techs with how many living people know them (or "Lost");
  // undiscovered ones as "???".
  function tech() {
    const { sim, data } = ctx;
    const nodes = [];
    let era = null;
    for (const t of data.techs) {
      if (t.era !== era) {
        era = t.era;
        nodes.push(el('h3', 'era', era));
      }
      const record = sim.discoveries[t.id];
      if (!record) {
        nodes.push(el('div', 'tech-row unknown', '???'));
        continue;
      }
      const n = sim.humans.filter((h) => h.knows.includes(t.id)).length;
      const r = button(`tech-row${n ? '' : ' lost'}`, '', () => toast(`${t.description} First found by ${record.by}.`));
      r.append(el('span', null, t.name), el('span', 'kind', n ? `Known by ${n}` : 'Lost'));
      nodes.push(r);
    }
    return nodes;
  }

  const TABS = { overview, people, items, tech };

  // Built fresh each refresh, but only swapped in when something visible
  // changed, so taps on rows aren't lost.
  function render() {
    const { sim, data } = ctx;
    $('tribe-title').textContent = sim.settlement.name;
    $('tribe-sub').textContent = `Sanctuary · ${sim.humans.length} people`;
    for (const b of document.querySelectorAll('#tribe .tabs button')) b.classList.toggle('active', b.dataset.tab === tab);
    const nodes = TABS[tab]();
    const key = `${tab}|${nodes.map((n) => n.textContent + (n.querySelector?.('.bar div')?.style.width ?? '')).join('|')}`;
    renderKeyed($('tribe-body'), key, () => nodes);
  }

  return { render };
}
