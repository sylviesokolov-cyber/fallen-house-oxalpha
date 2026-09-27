import { dateOf } from '../sim/time.js';
import { populationCap } from '../sim/settlement.js';
import { mealsInStock } from '../sim/items.js';
import { $, el } from './dom.js';
import { icon, iconHtml } from './icons.js';

// The top HUD: date card with a day/night dial, Faith and people, the
// stores as chips (numbers pop "+5" / "−3" as they change), and the clock.

const SEASON_ICON = { Spring: 'spring', Summer: 'summer', Autumn: 'autumn', Winter: 'winter' };
const SPEEDS = [1, 2, 4];
const SPEED_ICON = { 1: 'play', 2: 'fast', 4: 'faster' };
const DELTA_MS = 1500;

// [key, icon, value, always shown]
const STOCK = [
  ['wood', 'wood', (s) => s.stockpile.wood, true],
  ['food', 'potato', (s) => s.stockpile.food, true],
  ['meals', 'meal', (s, d) => mealsInStock(s, d), true],
  ['ale', 'ale', (s) => s.stockpile.potato_ale],
  ['meat', 'meat', (s) => s.stockpile.meat],
  ['ore', 'ore', (s) => s.stockpile.ore],
  ['crystal', 'crystal', (s) => s.stockpile.mana_crystal],
  ['remedy', 'remedy', (s) => s.stockpile.herbal_remedy],
];

export function createTopBar(ctx) {
  const chips = new Map();
  let lastSpeed = 1;
  let dialKey = null;

  // Remembers each value and how much it moved in the last window.
  function track(key, value, anchor) {
    const now = performance.now();
    let t = chips.get(key);
    if (!t) {
      t = { value, start: now, delta: 0, anchor };
      chips.set(key, t);
      return;
    }
    t.anchor = anchor;
    t.delta += value - t.value;
    t.value = value;
    if (now - t.start < DELTA_MS) return;
    if (Math.abs(t.delta) >= 1 && anchor?.isConnected) floatDelta(anchor, t.delta);
    t.delta = 0;
    t.start = now;
  }

  function floatDelta(anchor, delta) {
    const r = anchor.getBoundingClientRect();
    const f = el('div', `delta ${delta > 0 ? 'up' : 'down'}`, `${delta > 0 ? '+' : '−'}${Math.abs(Math.round(delta))}`);
    f.style.left = `${r.left + r.width / 2}px`;
    f.style.top = `${r.bottom - 4}px`;
    document.body.append(f);
    setTimeout(() => f.remove(), 1200);
  }

  function renderStock() {
    const { sim, data } = ctx;
    const box = $('stock');
    const shown = STOCK.filter(([, , get, always]) => always || get(sim, data) > 0);
    const key = shown.map(([k]) => k).join();
    if (box.dataset.key !== key) {
      box.dataset.key = key;
      box.replaceChildren(...shown.map(([k, ic]) => {
        const c = el('div', 'res-chip');
        c.dataset.res = k;
        c.append(icon(ic), el('span'));
        return c;
      }));
    }
    for (const c of box.children) {
      const [k, , get] = STOCK.find(([id]) => id === c.dataset.res);
      const v = get(sim, data) ?? 0;
      const text = compact(v);
      if (c.lastChild.textContent !== text) c.lastChild.textContent = text;
      track(k, v, c);
    }
  }

  // A ring that fills as the day goes by, with the sun or the moon inside.
  function renderDial() {
    const { sim, data } = ctx;
    const t = data.config.time;
    const frac = (sim.tick % t.ticksPerDay) / t.ticksPerDay;
    const night = frac > 0.76 || frac < 0.06;
    const key = `${Math.round(frac * 40)}|${night}`;
    if (key === dialKey) return;
    dialKey = key;
    const c = 2 * Math.PI * 15;
    $('day-dial').innerHTML = `<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" class="dial-track"/>`
      + `<circle cx="18" cy="18" r="15" class="dial-fill${night ? ' night' : ''}" stroke-dasharray="${(frac * c).toFixed(1)} ${c.toFixed(1)}"/></svg>`
      + iconHtml(night ? 'moon' : 'summer', 'dial-icon');
  }

  function render() {
    const { sim, data } = ctx;
    const d = dateOf(sim.tick, data.config.time);
    setText('date', `Day ${d.day}`);
    const season = $('season');
    const sKey = `${d.season}|${d.year}`;
    if (season.dataset.key !== sKey) {
      season.dataset.key = sKey;
      season.replaceChildren(icon(SEASON_ICON[d.season], 'season-icon'), el('span', null, `${d.season} · Year ${d.year}`));
    }
    renderDial();
    setText($('faith').lastChild, `${Math.floor(sim.faith)}`);
    setText($('pop').lastChild, `${sim.humans.length}/${populationCap(sim, data)}`);
    track('faith', sim.faith, $('faith'));
    renderStock();
  }

  function setSpeed(speed) {
    ctx.runner.speed = speed;
    if (speed) lastSpeed = speed;
    const paused = speed === 0;
    $('btn-pause').classList.toggle('active', paused);
    $('btn-pause').replaceChildren(icon(paused ? 'play' : 'pause'));
    $('btn-speed').replaceChildren(icon(SPEED_ICON[lastSpeed]), el('span', null, `${lastSpeed}x`));
    $('btn-speed').classList.toggle('dim', paused);
  }

  $('btn-pause').addEventListener('click', () => setSpeed(ctx.runner.speed ? 0 : lastSpeed));
  $('btn-speed').addEventListener('click', () => {
    const next = ctx.runner.speed === 0 ? lastSpeed : SPEEDS[(SPEEDS.indexOf(lastSpeed) + 1) % SPEEDS.length];
    setSpeed(next);
  });

  // A loaded or new world starts counting afresh (no giant "+500").
  ctx.events.on('sim-replaced', () => chips.clear());
  ctx.events.on('game-start', () => chips.clear());

  return { render, setSpeed, get lastSpeed() { return lastSpeed; } };
}

function setText(target, text) {
  const node = typeof target === 'string' ? $(target) : target;
  if (node.textContent !== text) node.textContent = text;
}

function compact(n) {
  return n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.floor(n)}`;
}
