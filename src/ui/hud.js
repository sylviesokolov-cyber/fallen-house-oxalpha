import { dateOf } from '../sim/time.js';
import { formatEntry } from '../sim/history.js';
import { humanAge } from '../sim/human.js';
import { serialize, deserialize } from '../sim/save.js';
import { xpToNext } from '../sim/skills.js';
import { bondValue, relationType } from '../sim/bonds.js';
import { lifeStage } from '../sim/lifecycle.js';

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
  socialize: 'Looking for company',
  chat: 'Chatting',
  goSleep: 'Heading to bed',
  build: 'Building',
  craft: 'Crafting',
};

const STAGE_LABELS = { child: 'child', adult: 'adult', elder: 'elder' };
const TIER_LABELS = { closeFriend: 'Close friend', friend: 'Friend', acquaintance: 'Acquaintance', rival: 'Rival' };
const MAX_BONDS_SHOWN = 7;

const $ = (id) => document.getElementById(id);

export function createHud(ctx) {
  let lastRefresh = 0;
  let logKey = null;
  let toastTimer = null;
  let traitsShownFor = null;
  let bondsKey = null;
  let knowsKey = null;
  let techKey = null;

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
    for (const p of ['inspect', 'log', 'tech', 'menu']) $(p).classList.toggle('hidden', p !== id);
  }

  for (const b of document.querySelectorAll('[data-speed]')) {
    b.addEventListener('click', () => setSpeed(Number(b.dataset.speed)));
  }

  $('btn-save').addEventListener('click', () => {
    try {
      localStorage.setItem(SAVE_KEY, serialize(ctx.sim));
      showPanel(null);
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
      bondsKey = null;
      knowsKey = null;
      techKey = null;
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
  $('btn-tech').addEventListener('click', () => {
    const open = !$('tech').classList.contains('hidden');
    showPanel(open ? null : 'tech');
    techKey = null;
  });
  $('tech-close').addEventListener('click', () => showPanel(null));
  $('btn-menu').addEventListener('click', () => showPanel($('menu').classList.contains('hidden') ? 'menu' : null));
  $('menu-close').addEventListener('click', () => showPanel(null));
  $('inspect-close').addEventListener('click', () => {
    ctx.selectedId = null;
    showPanel(null);
  });

  function renderTopBar() {
    const d = dateOf(ctx.sim.tick, ctx.data.config.time);
    $('date').textContent = `Day ${d.day} · ${d.season}, Year ${d.year}`;
    $('pop').textContent = `Pop ${ctx.sim.humans.length}`;
    const s = ctx.sim.stockpile;
    const parts = [`Wood ${s.wood}`, `Stone ${s.stone}`];
    if (s.clay) parts.push(`Clay ${s.clay}`);
    if (s.food + s.cooked_food) parts.push(`Food ${s.food + s.cooked_food}`);
    if (s.pottery) parts.push(`Pots ${s.pottery}`);
    $('stock').textContent = parts.join(' · ');
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
    renderKnows(who);
    $('insp-tools').textContent = h && Object.keys(h.tools).length
      ? `Carries: ${Object.keys(h.tools).map((id) => data.itemsById[id].name.toLowerCase()).join(', ')}`
      : '';
    if (dead) {
      $('insp-age').textContent = `Died on Day ${dateOf(dead.deathTick, data.config.time).day}`;
      $('insp-action').textContent = `Cause: ${dead.cause}`;
      return;
    }
    const expecting = h.pregnantUntil != null ? ', expecting a child' : '';
    $('insp-age').textContent = `Age ${humanAge(h, sim, data)}, ${STAGE_LABELS[lifeStage(h, sim, data)]}${expecting}`;
    const carrying = h.carrying ? ` (carrying ${h.carrying.amount} ${h.carrying.type})` : '';
    const chatWith = h.action.type === 'chat' ? sim.humans.find((o) => o.id === h.action.withId) : null;
    const label = chatWith ? `Chatting with ${chatWith.name}` : actionLabel(h);
    $('insp-action').textContent = `${label}${carrying}`;
    setBar('bar-health', h.health);
    setBar('bar-hunger', h.needs.hunger);
    setBar('bar-energy', h.needs.energy);
    setBar('bar-social', h.needs.social);
    renderSkills(h);
    renderBonds(h);
  }

  function actionLabel(h) {
    const a = h.action;
    if (a.type === 'craft') return a.itemId === 'cooked_food' ? 'Cooking' : `Making ${ctx.data.itemsById[a.itemId].name.toLowerCase()}`;
    if (a.type === 'build') {
      const site = ctx.sim.buildings.find((b) => b.id === a.siteId);
      return site ? `Building a ${ctx.data.buildingsById[site.type].name.toLowerCase()}` : 'Building';
    }
    if (a.type === 'sleep' && a.buildingId != null) return 'Sleeping in a shelter';
    if (a.type === 'seekFood' && a.stock) return 'Going to the stockpile to eat';
    return ACTION_LABELS[a.type] ?? a.type;
  }

  // Rebuilt only when what they know changes, so taps on the chips aren't lost.
  function renderKnows(who) {
    const key = `${who.id}:${who.knows.join()}`;
    if (key === knowsKey) return;
    knowsKey = key;
    if (!who.knows.length) {
      const p = document.createElement('div');
      p.className = 'empty';
      p.textContent = 'Nothing yet';
      return $('insp-knows').replaceChildren(p);
    }
    $('insp-knows').replaceChildren(...who.knows.map((id) => techChip(ctx.data.techsById[id])));
  }

  function techChip(tech) {
    const chip = document.createElement('button');
    chip.className = 'chip tech';
    chip.textContent = tech.name;
    chip.addEventListener('click', () => toast(tech.description));
    return chip;
  }

  // The tribe's knowledge: discovered techs with how many living people know
  // them (or "Lost"), undiscovered ones as "???". Plus a buildings summary.
  function renderTech() {
    const { sim, data } = ctx;
    const knowers = (id) => sim.humans.filter((h) => h.knows.includes(id)).length;
    const counts = {};
    for (const b of sim.buildings) {
      const c = (counts[b.type] ??= { built: 0, site: 0 });
      c[b.built ? 'built' : 'site']++;
    }
    const key = `${JSON.stringify(sim.discoveries)}|${data.techs.map((t) => knowers(t.id)).join()}|${JSON.stringify(counts)}`;
    if (key === techKey) return;
    techKey = key;

    const summary = Object.entries(counts).map(([type, c]) => {
      const name = data.buildingsById[type].name;
      return `${name} ${c.built}${c.site ? ` (+${c.site} building)` : ''}`;
    });
    $('tech-buildings').textContent = summary.length ? summary.join(' · ') : 'No buildings yet';

    const nodes = [];
    let era = null;
    for (const t of data.techs) {
      if (t.era !== era) {
        era = t.era;
        const h3 = document.createElement('h3');
        h3.textContent = era;
        nodes.push(h3);
      }
      const record = sim.discoveries[t.id];
      if (!record) {
        const row = document.createElement('div');
        row.className = 'tech-row unknown';
        row.textContent = '???';
        nodes.push(row);
        continue;
      }
      const n = knowers(t.id);
      const row = document.createElement('button');
      row.className = `tech-row${n ? '' : ' lost'}`;
      const name = document.createElement('span');
      name.textContent = t.name;
      const kind = document.createElement('span');
      kind.className = 'kind';
      kind.textContent = n ? `Known by ${n}` : 'Lost';
      row.append(name, kind);
      row.addEventListener('click', () => toast(`${t.description} First found by ${record.by}.`));
      nodes.push(row);
    }
    $('tech-list').replaceChildren(...nodes);
  }

  function familyLabel(h, o) {
    if (h.parents.includes(o.id)) return o.sex === 'female' ? 'Mother' : 'Father';
    if (o.parents.includes(h.id)) return o.sex === 'female' ? 'Daughter' : 'Son';
    return o.sex === 'female' ? 'Sister' : 'Brother';
  }

  // Partner first, then family, then the strongest friendships and rivalries.
  // The list is only rebuilt when it actually changes, so taps aren't lost.
  function renderBonds(h) {
    const { sim, data } = ctx;
    const rows = [];
    for (const o of sim.humans) {
      if (o === h) continue;
      const type = relationType(sim, data, h, o);
      if (type === 'stranger' || type === 'acquaintance') continue;
      const label = type === 'partner' ? 'Partner' : type === 'family' ? familyLabel(h, o) : TIER_LABELS[type];
      const rank = type === 'partner' ? 3 : type === 'family' ? 2 : type === 'rival' ? 0 : 1;
      rows.push({ o, type, label, rank, value: Math.abs(bondValue(sim, h, o)) });
    }
    rows.sort((a, b) => b.rank - a.rank || b.value - a.value);
    const shown = rows.slice(0, MAX_BONDS_SHOWN);
    const key = `${h.id}:${shown.map((r) => `${r.o.id}${r.label}`).join(',')}`;
    if (key === bondsKey) return;
    bondsKey = key;
    if (!shown.length) {
      const p = document.createElement('div');
      p.className = 'empty';
      p.textContent = 'No close ties yet';
      return $('insp-bonds').replaceChildren(p);
    }
    $('insp-bonds').replaceChildren(
      ...shown.map((r) => {
        const row = document.createElement('button');
        row.className = `bond ${r.type}`;
        const name = document.createElement('span');
        name.textContent = r.o.name;
        const kind = document.createElement('span');
        kind.className = 'kind';
        kind.textContent = r.label;
        row.append(name, kind);
        row.addEventListener('click', () => {
          ctx.selectedId = r.o.id;
          ctx.events.emit('focus-human', r.o.id);
          renderInspect();
        });
        return row;
      }),
    );
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
      if (!$('tech').classList.contains('hidden')) renderTech();
    },
  };
}
