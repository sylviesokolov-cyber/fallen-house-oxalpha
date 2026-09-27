import { dateOf } from '../sim/time.js';
import { formatEntry } from '../sim/history.js';
import { usePower } from '../sim/godPowers.js';
import { populationCap } from '../sim/settlement.js';
import { mealsInStock } from '../sim/items.js';
import { $, el, button } from './dom.js';
import { createCharacterSheet } from './characterSheet.js';
import { createTribePanel } from './tribePanel.js';
import { createPortalPanel } from './portalPanel.js';
import { createMenuPanel } from './menuPanel.js';

// The UI is plain HTML over the canvas: native text, scrolling and buttons
// work better on phones than drawing UI inside Phaser. This module owns the
// top bar, power toolbar, panel switching, save/load and the history log.

const REFRESH_MS = 200;
const PANELS = ['inspect', 'log', 'tribe', 'menu', 'omen', 'portal', 'help'];

const SEASON_ICON = { Spring: '🌱', Summer: '☀️', Autumn: '🍂', Winter: '❄️' };
// [pattern, icon, sound]
const NEWS = [
  [/ had a /, '👶', 'birth'],
  [/died|starved|slain|struck down|fell to|never came back/, '🕯️', 'death'],
  [/discovered/, '💡', 'discover'],
  [/was finished|was upgraded/, '🏠', 'build'],
  [/slew|lies open/, '⚔️', 'victory'],
  [/came home from/, '🌀', 'portal'],
  [/became partners/, '💞', 'love'],
  [/moved into/, '🏡', 'love'],
  [/became Warden/, '👑', 'discover'],
];

export function createHud(ctx, sound) {
  let lastRefresh = 0;
  let newsSeen = null;
  let logKey = null;
  let toastTimer = null;

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  const isOpen = (id) => !$(id).classList.contains('hidden');

  function showPanel(id) {
    for (const p of PANELS) $(p).classList.toggle('hidden', p !== id);
    $('powers').classList.toggle('hidden', !!id);
    if (id) selectPower(null);
  }

  function togglePanel(id) {
    showPanel(isOpen(id) ? null : id);
    refresh();
  }

  // Opens someone's character sheet (and, from a list, moves the camera to them).
  function selectPerson(id, pan = true) {
    ctx.selectedId = id;
    if (pan) ctx.events.emit('focus-human', id);
    showPanel('inspect');
    refresh();
  }

  const sheet = createCharacterSheet(ctx, { toast, select: selectPerson });
  const tribe = createTribePanel(ctx, { toast, select: selectPerson });
  const portal = createPortalPanel(ctx, { toast, select: selectPerson, close: () => showPanel(null) });

  // God-power toolbar. Picking a power arms it; the next tap on the map (a
  // tile, or a person for Bless/Inspire) uses it. Tap the button again to
  // cancel. Omen instead opens a list of callings to choose from.
  function selectPower(id) {
    ctx.selectedPower = id;
    for (const b of $('power-buttons').children) b.classList.toggle('selected', b.dataset.power === id);
    const power = id && ctx.data.powersById[id];
    $('power-hint').classList.toggle('hidden', !power);
    if (power) $('power-hint').textContent = `${power.description} Tap ${power.target === 'human' ? 'a person' : 'the map'}.`;
  }

  $('power-buttons').replaceChildren(
    ...ctx.data.powers.map((p) => {
      const b = button('', '', () => {
        if (p.target === 'focus') return togglePanel('omen');
        if (p.target === 'party') return togglePanel('portal');
        const turnOn = ctx.selectedPower !== p.id;
        if (turnOn) showPanel(null);
        selectPower(turnOn ? p.id : null);
      });
      b.dataset.power = p.id;
      b.append(el('span', null, `${p.icon ?? ''} ${p.name}`.trim()), el('span', 'cost', p.cost ? `${p.cost} faith` : 'dungeon'));
      return b;
    }),
  );

  $('omen-list').replaceChildren(
    ...ctx.data.focuses.map((f) => {
      const b = button('bond omen-choice', '', () => {
        const result = usePower(ctx.sim, ctx.data, 'omen', { focus: f.id });
        if (!result.ok) return toast(result.error);
        showPanel(null);
        ctx.events.emit('power-used', { powerId: 'omen', x: result.x, y: result.y });
        toast(`The people feel called to ${f.name}`);
      });
      const text = el('span', 'omen-text');
      text.append(el('strong', null, f.name), el('span', 'kind', f.description));
      b.append(text);
      return b;
    }),
  );

  for (const b of document.querySelectorAll('[data-speed]')) {
    b.addEventListener('click', () => setSpeed(Number(b.dataset.speed)));
  }

  function setSpeed(speed) {
    ctx.runner.speed = speed;
    for (const b of document.querySelectorAll('[data-speed]')) b.classList.toggle('active', Number(b.dataset.speed) === speed);
  }

  // Swaps in a loaded or brand-new world and redraws everything.
  function replaceSim(sim, message) {
    ctx.sim = sim;
    ctx.selectedId = null;
    ctx.runner.reset();
    logKey = null;
    newsSeen = null;
    for (const n of document.querySelectorAll('[data-key]')) n.dataset.key = '';
    showPanel(null);
    ctx.events.emit('sim-replaced');
    toast(`${message} (Year ${dateOf(sim.tick, ctx.data.config.time).year}, Day ${dateOf(sim.tick, ctx.data.config.time).day})`);
  }

  const menu = createMenuPanel(ctx, { toast, replaceSim, showPanel, sound });
  ctx.events.on('power-used', ({ powerId }) => sound.play(powerId));
  // A soft click for every button.
  document.addEventListener('click', (e) => {
    if (e.target.closest('button')) sound.play('tap');
  });

  $('btn-log').addEventListener('click', () => {
    logKey = null;
    togglePanel('log');
  });
  $('btn-tribe').addEventListener('click', () => togglePanel('tribe'));
  $('btn-menu').addEventListener('click', () => {
    menu.render();
    togglePanel('menu');
  });
  for (const id of ['log', 'tribe', 'menu', 'omen', 'portal', 'help']) $(`${id}-close`).addEventListener('click', () => showPanel(null));
  $('inspect-close').addEventListener('click', () => {
    ctx.selectedId = null;
    showPanel(null);
  });

  function renderTopBar() {
    const { sim, data } = ctx;
    const d = dateOf(sim.tick, data.config.time);
    $('date').textContent = `${SEASON_ICON[d.season] ?? ''} Day ${d.day} · ${d.season}, Year ${d.year}`;
    $('pop').textContent = `✨ ${Math.floor(sim.faith)} · 👥 ${sim.humans.length}/${populationCap(sim, data)}`;
    for (const b of $('power-buttons').children) b.classList.toggle('poor', sim.faith < data.powersById[b.dataset.power].cost);
    const s = sim.stockpile;
    const extra = [['🍺', s.potato_ale], ['🍖', s.meat], ['⛏️', s.ore], ['💎', s.mana_crystal], ['🌿', s.herbal_remedy]]
      .filter(([, n]) => n > 0).map(([icon, n]) => ` · ${icon} ${n}`).join('');
    $('stock').textContent = `🪵 ${s.wood} · 🥔 ${s.food} · 🍲 ${mealsInStock(sim, data)}${extra}`;
  }

  function renderLog() {
    const hist = ctx.sim.history;
    const key = `${hist.length}:${hist[hist.length - 1]?.tick}`;
    if (key === logKey) return;
    logKey = key;
    $('log-list').replaceChildren(...hist.slice().reverse().map((e) => el('li', null, formatEntry(e, ctx.data.config.time))));
  }

  // Big moments in anyone's life pop up as a banner for a few seconds.
  function renderNews() {
    const hist = ctx.sim.history;
    const last = hist.at(-1);
    if (newsSeen == null || newsSeen.sim !== ctx.sim) {
      newsSeen = { sim: ctx.sim, entry: last };
      return;
    }
    if (last === newsSeen.entry) return;
    const start = hist.lastIndexOf(newsSeen.entry) + 1;
    newsSeen.entry = last;
    const news = hist.slice(start).map((e) => [NEWS.find(([re]) => re.test(e.text)), e]).filter(([kind]) => kind);
    for (const [kind, e] of news.slice(-2)) showNews(kind[1], e.text);
    if (news.length) sound.play(news.at(-1)[0][2]);
  }

  function showNews(icon, text) {
    const box = $('news');
    box.style.top = `${$('topbar').offsetHeight + 8}px`;
    while (box.children.length >= 2) box.firstChild.remove();
    const item = button('news-item', '', () => {
      item.remove();
      logKey = null;
      showPanel('log');
      refresh();
    });
    item.append(el('span', 'news-icon', icon), el('span', null, text));
    box.append(item);
    setTimeout(() => item.classList.add('fade'), 4500);
    setTimeout(() => item.remove(), 5200);
  }

  function refresh() {
    renderTopBar();
    renderNews();
    if (isOpen('inspect') && !sheet.render()) showPanel(null);
    if (isOpen('log')) renderLog();
    if (isOpen('tribe')) tribe.render();
    if (isOpen('portal')) portal.render();
  }

  setSpeed(ctx.runner.speed);

  // First time here: explain the basics.
  try {
    if (!localStorage.getItem('godsim.seenHelp')) {
      localStorage.setItem('godsim.seenHelp', '1');
      showPanel('help');
    }
  } catch {
    // No storage: skip the intro.
  }

  return {
    toast,
    powerUsed() {
      selectPower(null);
    },
    openPortal() {
      showPanel('portal');
      refresh();
    },
    showInspect(id) {
      if (id == null) return showPanel(null);
      selectPerson(id, false);
    },
    update(now) {
      if (now - lastRefresh < REFRESH_MS) return;
      lastRefresh = now;
      refresh();
      menu.autosave(now);
    },
  };
}
