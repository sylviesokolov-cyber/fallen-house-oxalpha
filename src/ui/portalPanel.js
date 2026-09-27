import { usePower } from '../sim/godPowers.js';
import { activeExpedition, cannotGo } from '../sim/dungeon.js';
import { combatPower, heroFighter } from '../sim/combat.js';
import { gradeOf } from '../sim/stats.js';
import { $, el, button, bar, stars, renderKeyed } from './dom.js';

// The Portal panel: pick a floor and up to five heroes and send them in;
// follow a party that's out; read the battle reports of past expeditions.

const PHASE = { called: 'Gathering at the portal', inside: 'In the dungeon', returning: 'On the way home' };
const OUTCOME = {
  victory: 'Victory', retreated: 'Turned back', recalled: 'Called home', lost: 'Lost', cancelled: 'Never set out', returned: 'Came home',
  repelled: 'Repelled', overrun: 'Overrun',
};
const STYLE = { swordsmanship: '⚔️ Sword', archery: '🏹 Bow', magic: '🔮 Magic' };

export function createPortalPanel(ctx, { toast, select, close }) {
  const chosen = new Set();
  let floor = 1;
  let openReport = null;

  function section(title) {
    return el('h3', null, title);
  }

  function send() {
    const result = usePower(ctx.sim, ctx.data, 'portal', { party: [...chosen], floor });
    if (!result.ok) return toast(result.error);
    chosen.clear();
    ctx.events.emit('power-used', { powerId: 'portal', x: result.x, y: result.y });
    toast('The chosen feel the pull of the portal');
    close();
  }

  function recall() {
    const result = usePower(ctx.sim, ctx.data, 'portal', { recall: true });
    toast(result.ok ? 'You call the party home' : result.error);
  }

  function heroRow(h, onTap, selected) {
    const { data } = ctx;
    const f = heroFighter(h, data);
    const b = button(`person${selected ? ' chosen' : ''}`, '', onTap);
    const top = el('div', 'person-top');
    const name = el('span', 'person-name', `${selected ? '✓ ' : ''}${h.name} `);
    name.append(stars(h.grade, gradeOf(data, h.grade)));
    top.append(name, el('span', 'kind', `Lv ${h.level} · Power ${combatPower(h, data)}`));
    const sub = el('div', 'person-sub');
    sub.append(el('span', null, `${STYLE[f.style]} · HP ${Math.round(f.hp)}/${f.maxHp}`), bar(h.health / 100, 'hp'));
    b.append(top, sub);
    return b;
  }

  function status(exp) {
    const { sim, data } = ctx;
    const fl = data.floorsById[exp.floor];
    const nodes = [section(`Floor ${fl.id}: ${fl.name}`)];
    const where = exp.phase === 'inside' ? ` · room ${exp.room + 1} of ${fl.rooms + 1}` : '';
    nodes.push(el('div', 'sub', `${PHASE[exp.phase]}${where}${exp.recall ? ' · called home' : ''}`));
    for (const id of exp.members) {
      const h = sim.humans.find((o) => o.id === id);
      if (h) nodes.push(heroRow(h, () => select(h.id), false));
    }
    const loot = lootText(exp);
    if (loot) nodes.push(el('div', 'sub', `Loot so far: ${loot}`));
    if (exp.phase === 'inside' && !exp.recall) nodes.push(button('wide', 'Call them home', recall));
    return nodes;
  }

  function picker() {
    const { sim, data } = ctx;
    const nodes = [section('Floor')];
    const floors = el('div', 'tabs floors');
    for (const fl of data.dungeon.floors.filter((f) => f.id <= sim.dungeon.deepest)) {
      const b = button(fl.id === floor ? 'active' : '', `${fl.id}${sim.dungeon.cleared.includes(fl.id) ? ' ✓' : ''}`, () => {
        floor = fl.id;
        render(true);
      });
      floors.append(b);
    }
    const fl = data.floorsById[floor];
    nodes.push(floors, el('div', 'floor-desc', `${fl.name}: ${fl.description} ${fl.rooms} rooms, then the ${data.monstersById[fl.boss].name}.`));
    // Average power of the chosen party against what the floor calls for.
    const party = [...chosen].map((id) => sim.humans.find((h) => h.id === id)).filter(Boolean);
    const power = party.length ? Math.round(party.reduce((t, h) => t + combatPower(h, data), 0) / party.length) : 0;
    const odds = !party.length ? '' : power >= fl.power ? ' ready' : power >= fl.power * 0.8 ? ' risky' : ' deadly';
    const verdict = { ' ready': 'Ready', ' risky': 'Risky', ' deadly': 'Deadly' }[odds] ?? '';
    nodes.push(el('div', `power-check${odds}`, `Recommended power ${fl.power}${party.length ? ` · party ${power} · ${verdict}` : ''}`));
    nodes.push(section(`Party (${chosen.size}/${data.dungeon.maxParty})`));
    const ready = sim.humans.filter((h) => !cannotGo(sim, data, h)).sort((a, b) => combatPower(b, data) - combatPower(a, data));
    for (const id of [...chosen]) if (!ready.some((h) => h.id === id)) chosen.delete(id);
    for (const h of ready) {
      nodes.push(heroRow(h, () => {
        if (chosen.has(h.id)) chosen.delete(h.id);
        else if (chosen.size < data.dungeon.maxParty) chosen.add(h.id);
        else toast(`At most ${data.dungeon.maxParty} can go`);
        render(true);
      }, chosen.has(h.id)));
    }
    if (!ready.length) nodes.push(el('div', 'empty', 'Nobody is able to go.'));
    const go = button('wide send', chosen.size ? `Send ${chosen.size} into Floor ${floor}` : 'Choose who to send', send);
    go.disabled = !chosen.size;
    nodes.push(go);
    return nodes;
  }

  function reports() {
    const { data } = ctx;
    const done = ctx.sim.expeditions.filter((e) => e.reports.length).slice().reverse();
    const nodes = [section('Battle reports')];
    if (!done.length) nodes.push(el('div', 'empty', 'No expeditions or raids yet.'));
    for (const exp of done) {
      const fl = data.floorsById[exp.floor];
      const head = button('bond', '', () => {
        openReport = openReport === exp.id ? null : exp.id;
        render(true);
      });
      const label = exp.phase === 'done' ? OUTCOME[exp.outcome] ?? exp.outcome : 'Under way';
      head.append(el('span', null, exp.raid ? `#${exp.id} Raid on the sanctuary` : `#${exp.id} Floor ${fl.id}: ${fl.name}`), el('span', `kind outcome-${exp.outcome}`, label));
      nodes.push(head);
      if (openReport !== exp.id) continue;
      const box = el('div', 'report');
      const loot = lootText(exp);
      if (loot) box.append(el('div', 'report-loot', `Loot: ${loot}`));
      for (const r of exp.reports) {
        box.append(el('div', `report-title result-${r.result}`, `${r.title} — ${r.result}`));
        for (const line of r.lines) box.append(el('div', 'report-line', line));
      }
      nodes.push(box);
    }
    return nodes;
  }

  function lootText(exp) {
    return Object.entries(exp.loot).map(([id, n]) => `${n} ${ctx.data.itemsById[id].name.toLowerCase()}`).join(', ');
  }

  // Rebuilt when anything shown changes; `force` after a tap in the panel.
  // Rebuilt only when something that matters changes (who's shown, their HP
  // in 10% steps, the party's progress), so taps aren't lost to rebuilds
  // while people slowly heal.
  function stateKey() {
    const { sim } = ctx;
    const exp = activeExpedition(sim);
    const hp = sim.humans.map((h) => `${h.id}:${Math.round(h.health / 10)}:${h.level}:${h.away ?? ''}`).join();
    const trips = sim.expeditions.map((e) => `${e.id}${e.phase}${e.reports.length}`).join();
    return `${exp?.id}|${exp?.phase}|${exp?.room}|${exp?.recall}|${floor}|${[...chosen]}|${openReport}|${hp}|${trips}|${sim.dungeon.deepest}`;
  }

  function render(force = false) {
    const { sim } = ctx;
    const key = stateKey();
    if (force) $('portal-body').dataset.key = '';
    const exp = activeExpedition(sim);
    $('portal-sub').textContent = `Deepest floor open: ${sim.dungeon.deepest}`;
    renderKeyed($('portal-body'), key, () => [...(exp ? status(exp) : picker()), ...reports()]);
  }

  return { render };
}
