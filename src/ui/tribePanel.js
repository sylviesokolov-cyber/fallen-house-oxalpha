import { mood } from '../sim/mood.js';
import { emotionOf } from '../sim/emotions.js';
import { gradeOf, heroClass } from '../sim/stats.js';
import { leaderOf, leaderTitle, populationCap } from '../sim/settlement.js';
import { freePlotCount, jobProgress, nextUpgrade } from '../sim/construction.js';
import { $, el, button, bar, stars, renderKeyed } from './dom.js';
import { portrait, royalMarks } from './portrait.js';
import { appearance } from '../render/appearance.js';
import { lifeStage } from '../sim/lifecycle.js';
import { currentChapter, goalProgress } from '../sim/goals.js';

// The Tribe tab: an overview of the settlement's progress, a roster of every
// person, the tribe's inventory, its knowledge, and the milestones to reach.

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

    // Houses, largest first; the ruling house is marked.
    const houses = {};
    for (const h of sim.humans) houses[h.house] = (houses[h.house] ?? 0) + 1;
    nodes.push(section('Houses'));
    for (const [house, n] of Object.entries(houses).sort((a, b) => b[1] - a[1]).slice(0, 6)) {
      const ruling = house === sim.dynasty.house;
      nodes.push(row(`House ${house}${ruling ? (sim.dynasty.royal ? ' (royal)' : ' (ruling)') : ''}`, `${n} ${n === 1 ? 'member' : 'members'}`, ruling ? 'ruling' : ''));
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
      const r = button('bond', '', () => toast(buildingInfo(b)));
      r.append(el('span', null, def.name), el('span', 'kind', buildingStatus(b)));
      nodes.push(r);
    }
    nodes.push(row('Empty plots', `${freePlotCount(sim, data)} large · ${freePlotCount(sim, data, 'small')} small · ${freePlotCount(sim, data, 'home')} home`));

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

  function buildingStatus(b) {
    const { sim, data } = ctx;
    const p = jobProgress(data, b);
    if (!b.built) return `Building ${Math.floor(p * 100)}%`;
    if (b.upgrade) return `Lv ${b.level} → ${b.upgrade.level} ${Math.floor(p * 100)}%`;
    const owners = (b.owners ?? []).map((id) => sim.humans.find((h) => h.id === id)?.name).filter(Boolean);
    return owners.length ? `Home of ${owners.join(' & ')}` : `Lv ${b.level}`;
  }

  // The description, plus what the next upgrade needs (naming the tech only
  // once someone has found it).
  function buildingInfo(b) {
    const { sim, data } = ctx;
    const def = data.buildingsById[b.type];
    const u = b.built && !b.upgrade && nextUpgrade(data, b);
    if (!u) return def.description;
    const tech = !u.tech ? '' : sim.discoveries[u.tech] ? `${data.techsById[u.tech].name}, ` : 'a discovery not yet made, ';
    const cost = Object.entries(u.cost).map(([k, v]) => `${v} ${k}`).join(', ');
    return `${def.description} Level ${u.level} needs ${tech}${cost}.`;
  }

  function people() {
    const { sim, data } = ctx;
    const sorted = [...sim.humans].sort((a, b) => b.level - a.level || b.grade - a.grade);
    return sorted.map((h) => {
      const b = button('person with-face', '', () => select(h.id));
      const stage = lifeStage(h, sim, data);
      const face = portrait(appearance(h, stage === 'elder', data), h, stage, true, data, royalMarks(sim, h));
      face.classList.add('mini');
      const info = el('div', 'person-info');
      const top = el('div', 'person-top');
      const name = el('span', 'person-name', `${h.name} `);
      name.append(stars(h.grade, gradeOf(data, h.grade)));
      top.append(name, el('span', 'kind', `Lv ${h.level}`));
      const e = emotionOf(h, data);
      const bottom = el('div', 'person-sub');
      const emo = el('span', null, e.name);
      emo.style.color = e.color;
      bottom.append(el('span', null, h.away != null ? 'In the dungeon' : heroClass(h, data)), emo);
      info.append(top, bottom);
      b.append(face, info);
      return b;
    });
  }

  function items() {
    const { sim, data } = ctx;
    const nodes = [section('Stockpile')];
    nodes.push(row('Wood', `${sim.stockpile.wood}`), row('Potatoes', `${sim.stockpile.food}`));
    for (const def of data.items) {
      const n = sim.stockpile[def.id] ?? 0;
      if (n > 0 || (def.kind !== 'tool' && sim.discoveries[def.tech])) nodes.push(row(def.name, `${n}`));
    }
    nodes.push(section('Tools in use'));
    const tools = {};
    for (const h of sim.humans) for (const id of Object.keys(h.tools)) tools[id] = (tools[id] ?? 0) + 1;
    const toolRows = Object.entries(tools).map(([id, n]) => row(data.itemsById[id].name, `${n}`));
    nodes.push(...(toolRows.length ? toolRows : [el('div', 'empty', 'None yet')]));
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

  // Milestones by chapter. Chapters past the current one stay veiled.
  function goals() {
    const { sim, data } = ctx;
    const nodes = [];
    const current = currentChapter(sim, data);
    const chapters = [...new Set(data.goals.map((g) => g.chapter))];
    const reached = current == null ? chapters.length : chapters.indexOf(current);
    chapters.forEach((ch, i) => {
      if (i > reached) {
        if (i === reached + 1) nodes.push(el('h3', 'era', `Chapter ${i + 1}`), el('div', 'empty', 'Finish this chapter to see what comes next.'));
        return;
      }
      nodes.push(el('h3', 'era', `Chapter ${i + 1}: ${ch}`));
      for (const g of data.goals.filter((o) => o.chapter === ch)) {
        const p = goalProgress(sim, data, g);
        const r = el('div', `goal${p.done ? ' done' : ''}`);
        const top = el('div', 'goal-top');
        top.append(el('span', 'goal-name', `${p.done ? '✓ ' : ''}${g.name}`), el('span', 'kind', p.done ? 'Reached' : `+${g.reward} Faith`));
        r.append(top, el('div', 'goal-desc', g.description));
        if (!p.done && p.need > 1) r.append(el('div', 'goal-count', `${p.have} / ${p.need}`), bar(p.have / p.need, 'goal-bar'));
        nodes.push(r);
      }
    });
    if (current == null) nodes.push(el('div', 'empty', 'Every milestone is reached. The sanctuary’s legend is complete.'));
    return nodes;
  }

  const TABS = { overview, people, items, tech, goals };

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
