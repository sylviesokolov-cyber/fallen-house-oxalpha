import { dateOf } from '../sim/time.js';
import { formatEntry } from '../sim/history.js';
import { humanAge } from '../sim/human.js';
import { serialize, deserialize } from '../sim/save.js';
import { xpToNext } from '../sim/skills.js';

// The UI is plain HTML over the canvas: native text, scrolling and buttons
// work better on phones than drawing UI inside Phaser.

const SAVE_KEY = 'godsim.save';
const REFRESH_MS = 200;
const ACTION_LABELS = {
  idle: 'Resting',
  wander: 'Wandering',
  seekFood: 'Looking for food',
  eat: 'Eating berries',
  sleep: 'Sleeping',
  gather: 'Heading out to gather',
  harvest: 'Gathering',
  deposit: 'Hauling to stockpile',
};

const $ = (id) => document.getElementById(id);

export function createHud(ctx) {
  let lastRefresh = 0;
  let logKey = null;
  let toastTimer = null;
  let traitsShownFor = null;

  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  function setSpeed(speed) {
    ctx.runner.speed = speed;
    for (const b of document.querySelectorAll('[data-speed]')) {
      b.classList.toggle('active', Number(b.dataset.speed) === speed);
    }
  }

  function showPanel(id) {
    for (const p of ['inspect', 'log']) $(p).classList.toggle('hidden', p !== id);
  }

  for (const b of document.querySelectorAll('[data-speed]')) {
    b.addEventListener('click', () => setSpeed(Number(b.dataset.speed)));
  }

  $('btn-save').addEventListener('click', () => {
    try {
      localStorage.setItem(SAVE_KEY, serialize(ctx.sim));
      toast(`Saved (Day ${dateOf(ctx.sim.tick, ctx.data.config.time).day})`);
    } catch (e) {
      toast(`Save failed: ${e.message}`);
    }
  });

  $('btn-load').addEventListener('click', () => {
    const json = localStorage.getItem(SAVE_KEY);
    if (!json) return toast('No save found');
    try {
      ctx.sim = deserialize(json);
      ctx.selectedId = null;
      ctx.runner.reset();
      logKey = null;
      traitsShownFor = null;
      showPanel(null);
      ctx.events.emit('sim-replaced');
      toast(`Loaded (Day ${dateOf(ctx.sim.tick, ctx.data.config.time).day})`);
    } catch (e) {
      toast(`Load failed: ${e.message}`);
    }
  });

  $('btn-log').addEventListener('click', () => {
    const open = !$('log').classList.contains('hidden');
    showPanel(open ? null : 'log');
    logKey = null;
  });
  $('log-close').addEventListener('click', () => showPanel(null));
  $('inspect-close').addEventListener('click', () => {
    ctx.selectedId = null;
    showPanel(null);
  });

  function renderTopBar() {
    const d = dateOf(ctx.sim.tick, ctx.data.config.time);
    $('date').textContent = `Day ${d.day} · ${d.season}, Year ${d.year}`;
    $('pop').textContent = `Pop ${ctx.sim.humans.length}`;
    const { wood, stone } = ctx.sim.stockpile;
    $('stock').textContent = `Wood ${wood} · Stone ${stone}`;
  }

  function setBar(id, value) {
    const bar = $(id);
    bar.style.width = `${value}%`;
    bar.classList.toggle('low', value < 30);
  }

  function renderInspect() {
    const { sim, data, selectedId } = ctx;
    const h = sim.humans.find((o) => o.id === selectedId);
    const dead = h ? null : sim.dead.find((o) => o.id === selectedId);
    if (!h && !dead) return showPanel(null);
    const who = h ?? dead;
    $('insp-name').textContent = `${who.name} ${who.sex === 'female' ? '♀' : '♂'}`;
    $('insp-needs').classList.toggle('hidden', !h);
    if (traitsShownFor !== who.id) renderTraits(who);
    if (dead) {
      $('insp-age').textContent = `Died on Day ${dateOf(dead.deathTick, data.config.time).day}`;
      $('insp-action').textContent = `Cause: ${dead.cause}`;
      return;
    }
    $('insp-age').textContent = `Age ${humanAge(h, sim, data)}`;
    const carrying = h.carrying ? ` (carrying ${h.carrying.amount} ${h.carrying.type})` : '';
    $('insp-action').textContent = `${ACTION_LABELS[h.action.type] ?? h.action.type}${carrying}`;
    setBar('bar-health', h.health);
    setBar('bar-hunger', h.needs.hunger);
    setBar('bar-energy', h.needs.energy);
    renderSkills(h);
  }

  // Traits never change, so the chips are only rebuilt when the selection
  // changes (rebuilding every refresh would swallow taps on them).
  function renderTraits(who) {
    traitsShownFor = who.id;
    $('insp-traits').replaceChildren(
      ...who.traits.map((id) => {
        const t = ctx.data.traitsById[id];
        const chip = document.createElement('button');
        chip.className = 'chip';
        chip.textContent = t.name;
        chip.addEventListener('click', () => toast(t.description));
        return chip;
      }),
    );
  }

  function renderSkills(h) {
    const cfg = ctx.data.config.skills;
    const learned = Object.entries(h.skills).sort((a, b) => b[1].level - a[1].level || b[1].xp - a[1].xp);
    if (!learned.length) {
      const p = document.createElement('div');
      p.className = 'empty';
      p.textContent = 'Nothing learned yet';
      return $('insp-skills').replaceChildren(p);
    }
    $('insp-skills').replaceChildren(
      ...learned.map(([id, s]) => {
        const row = document.createElement('div');
        row.className = 'need skill';
        const label = document.createElement('label');
        label.textContent = `${ctx.data.skillsById[id].name} ${s.level}`;
        const bar = document.createElement('div');
        bar.className = 'bar';
        const fill = document.createElement('div');
        const progress = s.level >= cfg.maxLevel ? 1 : s.xp / xpToNext(s.level, cfg);
        fill.style.width = `${Math.round(progress * 100)}%`;
        bar.append(fill);
        row.append(label, bar);
        return row;
      }),
    );
  }

  function renderLog() {
    const hist = ctx.sim.history;
    const key = `${hist.length}:${hist[hist.length - 1]?.tick}`;
    if (key === logKey) return;
    logKey = key;
    const list = $('log-list');
    list.replaceChildren(
      ...hist.slice().reverse().map((e) => {
        const li = document.createElement('li');
        li.textContent = formatEntry(e, ctx.data.config.time);
        return li;
      }),
    );
  }

  setSpeed(ctx.runner.speed);

  return {
    showInspect(id) {
      showPanel(id == null ? null : 'inspect');
      if (id != null) renderInspect();
    },
    update(now) {
      if (now - lastRefresh < REFRESH_MS) return;
      lastRefresh = now;
      renderTopBar();
      if (!$('inspect').classList.contains('hidden')) renderInspect();
      if (!$('log').classList.contains('hidden')) renderLog();
    },
  };
}
