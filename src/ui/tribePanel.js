import { mood } from '../sim/mood.js';
import { emotionOf } from '../sim/emotions.js';
import { gradeOf, heroClass } from '../sim/stats.js';
import { leaderOf, leaderTitle, populationCap } from '../sim/settlement.js';
import { freePlotCount, jobProgress, nextUpgrade } from '../sim/construction.js';
import { $, el, button, bar, stars, renderKeyed } from './dom.js';
import { artIcon } from './itemArt.js';
import { icon } from './icons.js';
import { usePower } from '../sim/godPowers.js';
import { nextTier, tierDef, tierOf, tierRequirements } from '../sim/tiers.js';
import { rankIndex } from '../sim/rank.js';
import { lawLevel } from '../sim/crime.js';
import { haptic } from './sheets.js';
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

  // The next tier of the sanctuary: what it needs, and the god's button.
  function expansion() {
    const { sim, data } = ctx;
    const t = nextTier(sim, data);
    const here = tierDef(data, tierOf(sim));
    if (!t) return [section(`The ${here.name}`), el('div', 'sub', 'The walls stand at their widest.')];
    const reqs = tierRequirements(sim, data);
    const card = el('div', 'expand-card');
    card.append(el('div', 'expand-title', `${here.name} → ${t.name}`), el('div', 'goal-desc', t.description));
    for (const r of reqs) {
      const line = el('div', `expand-req${r.ok ? ' ok' : ''}`);
      line.append(el('span', null, `${r.ok ? '✓ ' : ''}${r.label}`), el('span', 'kind', `${r.have} / ${r.need}`));
      card.append(line, bar(r.have / r.need, 'goal-bar'));
    }
    const ready = reqs.every((r) => r.ok);
    const b = button(`wide expand-btn${ready ? '' : ' locked'}`, '', () => {
      const result = usePower(sim, data, 'expand', {});
      if (!result.ok) return toast(result.error);
      haptic([30, 50, 30, 50, 80]);
      ctx.events.emit('world-expanded');
      ctx.events.emit('power-used', { powerId: 'decree', x: result.x, y: result.y });
      toast(`The walls rise: ${sim.settlement.name} is now a ${t.name}`);
      render();
    });
    b.append(icon('house'), el('span', null, ready ? `Raise the walls (${t.cost} Faith)` : 'Not ready yet'));
    card.append(b);
    return [section('Expand the sanctuary'), card];
  }

  // Ranks, the law, and crime.
  function society() {
    const { sim, data } = ctx;
    const counts = data.ranks.map(() => 0);
    for (const h of sim.humans) {
      const i = rankIndex(sim, data, h);
      if (i >= 0) counts[i]++;
    }
    const nodes = [section('Society')];
    const ladder = el('div', 'rank-ladder');
    data.ranks.forEach((r, i) => {
      if (!counts[i] && i === 0) return;
      const chip = button('rank-chip', `${r.name} ${counts[i]}`, () => toast(r.description));
      chip.style.setProperty('--rank', r.color);
      ladder.append(chip);
    });
    const law = lawLevel(sim, data);
    const jailed = sim.humans.filter((h) => h.punished).length;
    nodes.push(ladder,
      row('The law', law[0].toUpperCase() + law.slice(1)),
      row('Crimes so far', `${sim.tribeCounters.crimes ?? 0}${jailed ? ` · ${jailed} serving a sentence` : ''}`),
      row('Exiled', `${sim.dead.filter((d) => d.cause === 'exile').length}`));
    return nodes;
  }

  function overview() {
    const { sim, data } = ctx;
    const nodes = [...expansion(), ...society()];
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
      const r = button('bond with-art', '', () => toast(buildingInfo(b)));
      const name = el('span', 'art-name');
      name.append(artIcon(def), el('span', null, def.name));
      r.append(name, el('span', 'kind', buildingStatus(b)));
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
      row('Lives lost', `${sim.dead.filter((d) => d.cause !== 'exile').length}`),
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
      const r = data.ranks[rankIndex(sim, data, h)];
      const cls = el('span', null, h.away != null ? 'In the dungeon' : h.punished ? 'Serving a sentence' : heroClass(h, data));
      if (r) {
        const chip = el('span', 'rank-chip small', r.name);
        chip.style.setProperty('--rank', r.color);
        cls.prepend(chip, ' ');
      }
      bottom.append(cls, emo);
      info.append(top, bottom);
      b.append(face, info);
      return b;
    });
  }

  // A tile per thing in the stores: picture, count and name.
  function tile(def, n, onTap) {
    const t = button('item-tile', '', onTap);
    t.append(artIcon(def), el('span', 'item-count', `${n}`), el('span', 'item-name', def.name));
    return t;
  }

  function items() {
    const { sim, data } = ctx;
    const info = (def) => () => toast(def.description ?? `${def.name}${def.kind ? ` (${def.kind})` : ''}`);
    const stock = el('div', 'item-grid');
    const basics = [{ id: 'wood', name: 'Wood', art: 'log', description: 'From the grove.' }, { id: 'food', name: 'Potatoes', art: 'potato', description: 'From the field.' }];
    for (const def of basics) stock.append(tile(def, sim.stockpile[def.id], info(def)));
    for (const def of data.items) {
      const n = sim.stockpile[def.id] ?? 0;
      if (n > 0 || (def.kind !== 'tool' && sim.discoveries[def.tech])) stock.append(tile(def, n, info(def)));
    }
    const tools = {};
    for (const h of sim.humans) for (const id of Object.keys(h.tools)) tools[id] = (tools[id] ?? 0) + 1;
    const used = el('div', 'item-grid');
    for (const [id, n] of Object.entries(tools)) used.append(tile(data.itemsById[id], n, info(data.itemsById[id])));
    return [section('Stockpile'), stock, section('Tools in use'), Object.keys(tools).length ? used : el('div', 'empty', 'None yet')];
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
      const r = button(`tech-row with-art${n ? '' : ' lost'}`, '', () => toast(`${t.description} First found by ${record.by}.`));
      const name = el('span', 'art-name');
      name.append(artIcon(t), el('span', null, t.name));
      r.append(name, el('span', 'kind', n ? `Known by ${n}` : 'Lost'));
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
    $('tribe-sub').textContent = `${tierDef(data, tierOf(sim))?.name ?? 'Sanctuary'} · ${sim.humans.length} people`;
    for (const b of document.querySelectorAll('#tribe .tabs button')) b.classList.toggle('active', b.dataset.tab === tab);
    const nodes = TABS[tab]();
    const key = `${tab}|${nodes.map((n) => n.textContent + (n.querySelector?.('.bar div')?.style.width ?? '')).join('|')}`;
    renderKeyed($('tribe-body'), key, () => nodes);
  }

  return { render };
}
