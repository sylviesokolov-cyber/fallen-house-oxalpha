import { dateOf } from '../sim/time.js';
import { formatEntry } from '../sim/history.js';
import { usePower } from '../sim/godPowers.js';
import { $, el, button } from './dom.js';
import { icon, hydrateIcons } from './icons.js';
import { createCharacterSheet } from './characterSheet.js';
import { createTribePanel } from './tribePanel.js';
import { createPortalPanel } from './portalPanel.js';
import { createMenuPanel } from './menuPanel.js';
import { createTopBar } from './topBar.js';
import { createSheets, haptic } from './sheets.js';
import { createTitleScreen } from './titleScreen.js';
import { createThronePanel } from './thronePanel.js';

// The UI is plain HTML over the canvas: native text, scrolling and buttons
// work better on phones than drawing UI inside Phaser. This module wires the
// pieces together: top bar, power dock, sheets, news banners, title screen.

const REFRESH_MS = 200;
const PANELS = ['inspect', 'log', 'tribe', 'menu', 'omen', 'portal', 'help', 'throne'];

// [pattern, icon, sound, vibration]
const NEWS = [
  [/ had a /, 'baby', 'birth', [10, 40, 10]],
  [/died|starved|slain|struck down|fell to|never came back/, 'candle', 'death', [60]],
  [/discovered/, 'bulb', 'discover'],
  [/was finished|was upgraded/, 'house', 'build'],
  [/slew|lies open/, 'swords', 'victory', [20, 30, 20]],
  [/came home from/, 'portal', 'portal'],
  [/became partners/, 'heart', 'love'],
  [/moved into/, 'house', 'love'],
  [/became Warden/, 'crown', 'discover'],
];

export function createHud(ctx, sound) {
  let lastRefresh = 0;
  let newsSeen = null;
  let logKey = null;
  let toastTimer = null;

  hydrateIcons();
  const top = createTopBar(ctx);

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  const sheets = createSheets(PANELS, {
    onChange(id) {
      document.body.classList.toggle('sheet-open', !!id);
      if (id) selectPower(null);
      if (id !== 'inspect') ctx.selectedId = null;
    },
  });
  const isOpen = (id) => sheets.current === id;
  const showPanel = (id) => sheets.show(id);

  function togglePanel(id) {
    showPanel(isOpen(id) ? null : id);
    refresh();
  }

  // Opens someone's character sheet (and, from a list, moves the camera to them).
  function selectPerson(id, pan = true) {
    showPanel('inspect');
    ctx.selectedId = id;
    if (pan) ctx.events.emit('focus-human', id);
    refresh();
  }

  const sheet = createCharacterSheet(ctx, { toast, select: selectPerson });
  const tribe = createTribePanel(ctx, { toast, select: selectPerson });
  const portal = createPortalPanel(ctx, { toast, select: selectPerson, close: () => showPanel(null) });
  const throne = createThronePanel(ctx, { toast, select: selectPerson });

  // God-power dock. Picking Bless or Inspire arms it; the next tap on a
  // person uses it (tap the button again to cancel). Omen and Portal open
  // their own sheets.
  function selectPower(id) {
    ctx.selectedPower = id;
    for (const b of $('power-buttons').children) b.classList.toggle('selected', b.dataset.power === id);
    const power = id && ctx.data.powersById[id];
    $('power-hint').classList.toggle('hidden', !power);
    if (power) $('power-hint').textContent = `${power.description} Tap ${power.target === 'human' ? 'a person' : 'the map'}.`;
  }

  // The Throne sits in the dock beside the powers.
  const throneButton = button('power', '', () => {
    haptic();
    throne.reset();
    togglePanel('throne');
  });
  throneButton.dataset.power = 'throne';
  const throneOrb = el('span', 'power-orb');
  throneOrb.append(icon('crown'));
  throneButton.append(throneOrb, el('span', 'power-name', 'Throne'), el('span', 'cost', 'decrees'));

  $('power-buttons').replaceChildren(
    ...ctx.data.powers.filter((p) => p.dock).map((p) => {
      const b = button('power', '', () => {
        haptic();
        if (p.target === 'focus') return togglePanel('omen');
        if (p.target === 'party') return togglePanel('portal');
        const turnOn = ctx.selectedPower !== p.id;
        if (turnOn) showPanel(null);
        selectPower(turnOn ? p.id : null);
      });
      b.dataset.power = p.id;
      const orb = el('span', 'power-orb');
      orb.append(icon(p.id));
      b.append(orb, el('span', 'power-name', p.name), el('span', 'cost', p.cost ? `${p.cost}` : 'free'));
      if (p.cost) b.lastChild.prepend(icon('faith', 'cost-icon'));
      return b;
    }),
    throneButton,
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
    const d = dateOf(sim.tick, ctx.data.config.time);
    toast(`${message} (Year ${d.year}, Day ${d.day})`);
  }

  const menu = createMenuPanel(ctx, { toast, replaceSim, showPanel, sound });
  ctx.events.on('power-used', ({ powerId }) => {
    sound.play(powerId);
    haptic([15, 30, 15]);
  });
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
  for (const id of ['log', 'tribe', 'menu', 'omen', 'portal', 'help', 'inspect', 'throne']) $(`${id}-close`).addEventListener('click', () => showPanel(null));

  function renderLog() {
    const hist = ctx.sim.history;
    const key = `${hist.length}:${hist[hist.length - 1]?.tick}`;
    if (key === logKey) return;
    logKey = key;
    $('log-list').replaceChildren(...hist.slice().reverse().map((e) => {
      const kind = NEWS.find(([re]) => re.test(e.text));
      const li = el('li', kind ? 'major' : null);
      if (kind) li.append(icon(kind[1]));
      li.append(el('span', null, formatEntry(e, ctx.data.config.time)));
      return li;
    }));
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
    if (!news.length) return;
    const [, , snd, buzz] = news.at(-1)[0];
    sound.play(snd);
    if (buzz) haptic(buzz);
  }

  function showNews(iconName, text) {
    const box = $('news');
    box.style.top = `${$('topbar').offsetHeight + 8}px`;
    while (box.children.length >= 2) box.firstChild.remove();
    const item = button('news-item', '', () => {
      item.remove();
      logKey = null;
      showPanel('log');
      refresh();
    });
    const badge = el('span', 'news-icon');
    badge.append(icon(iconName));
    item.append(badge, el('span', null, text));
    box.append(item);
    setTimeout(() => item.classList.add('fade'), 4500);
    setTimeout(() => item.remove(), 5200);
  }

  function refresh() {
    top.render();
    for (const b of $('power-buttons').children) b.classList.toggle('poor', ctx.sim.faith < (ctx.data.powersById[b.dataset.power]?.cost ?? 0));
    renderNews();
    if (isOpen('inspect') && !sheet.render()) showPanel(null);
    if (isOpen('log')) renderLog();
    if (isOpen('tribe')) tribe.render();
    if (isOpen('portal')) portal.render();
    if (isOpen('throne')) throne.render();
  }

  createTitleScreen(ctx, {
    start: () => {
      ctx.events.emit('game-start');
      top.setSpeed(1);
    },
    replaceSim,
    showHelp: () => showPanel('help'),
  });
  top.setSpeed(0);

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
