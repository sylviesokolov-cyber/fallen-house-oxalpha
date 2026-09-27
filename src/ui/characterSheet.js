import { dateOf } from '../sim/time.js';
import { humanAge } from '../sim/human.js';
import { xpToNext } from '../sim/skills.js';
import { bondValue, relationType } from '../sim/bonds.js';
import { lifeStage } from '../sim/lifecycle.js';
import { mood } from '../sim/mood.js';
import { isBlessed, isInspired } from '../sim/status.js';
import { emotionOf } from '../sim/emotions.js';
import { gradeOf, heroClass, xpForLevel } from '../sim/stats.js';
import { leaderTitle } from '../sim/settlement.js';
import { $, el, bar, button, stars, renderKeyed } from './dom.js';

// The inspect panel as a hero's character sheet: grade, level and class,
// emotion, stats, needs, thoughts, relationships, skills and knowledge.

const ACTION_LABELS = {
  idle: 'Resting',
  wander: 'Wandering',
  seekFood: 'Looking for food',
  eat: 'Eating',
  sleep: 'Sleeping',
  gather: 'Heading out to gather',
  harvest: 'Gathering',
  deposit: 'Hauling to stockpile',
  socialize: 'Looking for company',
  chat: 'Chatting',
  goSleep: 'Heading to bed',
  build: 'Building',
  craft: 'Crafting',
  pray: 'Praying in the Great Hall',
  train: 'Training',
};
const TIER_LABELS = { closeFriend: 'Close friend', friend: 'Friend', acquaintance: 'Acquaintance', rival: 'Rival' };
const MAX_BONDS_SHOWN = 7;

export function createCharacterSheet(ctx, { toast, select }) {
  const setNeed = (id, value) => {
    const b = $(id);
    b.style.width = `${value}%`;
    b.classList.toggle('low', value < 30);
  };

  function actionLabel(h) {
    const { sim, data } = ctx;
    const a = h.action;
    if (a.type === 'chat') {
      const other = sim.humans.find((o) => o.id === a.withId);
      if (other) return `Chatting with ${other.name}`;
    }
    if (a.type === 'craft') return a.itemId === 'cooked_food' ? 'Cooking' : `Making ${data.itemsById[a.itemId].name.toLowerCase()}`;
    if (a.type === 'build') {
      const site = sim.buildings.find((b) => b.id === a.siteId);
      return site ? `Building a ${data.buildingsById[site.type].name.toLowerCase()}` : 'Building';
    }
    if (a.type === 'seekFood' && a.dine) return 'Going to the Dining Hall';
    if (a.type === 'seekFood' && a.stock) return 'Going to the store for potatoes';
    if (a.type === 'eat' && a.dine) return 'Having a meal in the Dining Hall';
    if (a.type === 'eat' && !a.stock && !a.fromCarry) return 'Eating raw potatoes in the field';
    if (a.type === 'train' && lifeStage(h, sim, data) === 'child') return 'Playing at the Training Ground';
    if (a.type === 'sleep' && a.buildingId != null) return `Sleeping in the ${data.buildingsById[sim.buildings.find((b) => b.id === a.buildingId)?.type]?.name ?? 'hall'}`;
    return ACTION_LABELS[a.type] ?? a.type;
  }

  function renderHeader(who, alive) {
    const { sim, data } = ctx;
    $('insp-name').textContent = `${who.name} ${who.sex === 'female' ? '♀' : '♂'}`;
    const grade = gradeOf(data, who.grade);
    const cls = alive ? heroClass(who, data) : '';
    renderKeyed($('insp-hero'), `${who.id}:${who.level}:${cls}`, () => [
      stars(who.grade, grade),
      el('span', 'hero-meta', ` ${grade.name} · Lv ${who.level}${cls ? ` · ${cls}` : ''}`),
    ]);
    const isLeader = alive && sim.settlement.leaderId === who.id;
    $('insp-leader').textContent = isLeader ? `${leaderTitle(sim, data, who)} of ${sim.settlement.name}` : '';
  }

  function renderEmotion(h) {
    const e = emotionOf(h, ctx.data);
    renderKeyed($('insp-emotion-row'), e.id, () => {
      const chip = button('chip emotion', e.name, () => toast(e.description));
      chip.style.borderColor = e.color;
      chip.style.color = e.color;
      return [chip];
    });
  }

  function renderStats(h) {
    const { data } = ctx;
    const key = `${h.id}:${Object.values(h.stats).join()}`;
    renderKeyed($('insp-stats'), key, () => data.stats.map((s) => {
      const cell = button('stat', '', () => toast(`${s.name}: ${s.description}`));
      cell.append(el('span', 'stat-name', s.id.toUpperCase()), el('span', 'stat-value', String(h.stats[s.id])));
      return cell;
    }));
    const need = xpForLevel(h.level, data);
    renderKeyed($('insp-level'), `${h.level}:${Math.floor((h.xp / need) * 50)}`, () => {
      const row = el('div', 'need');
      row.append(el('label', null, `Lv ${h.level}`), bar(h.level >= data.config.level.max ? 1 : h.xp / need, 'xp'));
      return [row];
    });
  }

  // Thoughts: what's lifting or weighing on them, with the mood effect.
  function renderThoughts(h) {
    const { sim } = ctx;
    const rows = h.feelings.map((f) => ({ text: f.text, value: f.value }));
    if (isInspired(h, sim) && !rows.some((r) => r.text.startsWith('Had a strange'))) rows.push({ text: 'Inspired', value: 0 });
    if (isBlessed(h, sim) && !rows.some((r) => r.text.startsWith('Blessed'))) rows.push({ text: 'Blessed', value: 0 });
    rows.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    const key = rows.map((r) => r.text).join('|');
    renderKeyed($('insp-thoughts'), key, () => {
      if (!rows.length) return [el('div', 'empty', 'Nothing on their mind')];
      return rows.map((r) => {
        const row = el('div', 'thought');
        const v = el('span', r.value >= 0 ? 'good' : 'bad', r.value ? `${r.value > 0 ? '+' : ''}${r.value}` : '·');
        row.append(v, el('span', null, r.text));
        return row;
      });
    });
  }

  function familyLabel(h, o) {
    if (h.parents.includes(o.id)) return o.sex === 'female' ? 'Mother' : 'Father';
    if (o.parents.includes(h.id)) return o.sex === 'female' ? 'Daughter' : 'Son';
    return o.sex === 'female' ? 'Sister' : 'Brother';
  }

  // Partner first, then family, then the strongest friendships and rivalries.
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
    renderKeyed($('insp-bonds'), `${h.id}:${shown.map((r) => `${r.o.id}${r.label}`).join(',')}`, () => {
      if (!shown.length) return [el('div', 'empty', 'No close ties yet')];
      return shown.map((r) => {
        const row = button(`bond ${r.type}`, '', () => select(r.o.id));
        row.append(el('span', null, r.o.name), el('span', 'kind', r.label));
        return row;
      });
    });
  }

  function renderSkills(h) {
    const cfg = ctx.data.config.skills;
    const learned = Object.entries(h.skills).sort((a, b) => b[1].level - a[1].level || b[1].xp - a[1].xp);
    renderKeyed($('insp-skills'), learned.map(([id, s]) => `${id}${s.level}:${Math.floor(s.xp)}`).join(), () => {
      if (!learned.length) return [el('div', 'empty', 'Nothing learned yet')];
      return learned.map(([id, s]) => {
        const row = el('div', 'need skill');
        const progress = s.level >= cfg.maxLevel ? 1 : s.xp / xpToNext(s.level, cfg);
        row.append(el('label', null, `${ctx.data.skillsById[id].name} ${s.level}`), bar(progress));
        return row;
      });
    });
  }

  function renderChips(containerId, ids, byId, className) {
    renderKeyed($(containerId), ids.join(), () => {
      if (!ids.length) return [el('div', 'empty', 'Nothing yet')];
      return ids.map((id) => button(className, byId[id].name, () => toast(byId[id].description)));
    });
  }

  function render() {
    const { sim, data, selectedId } = ctx;
    const h = sim.humans.find((o) => o.id === selectedId);
    const dead = h ? null : sim.dead.find((o) => o.id === selectedId);
    if (!h && !dead) return false;
    const who = h ?? dead;
    renderHeader(who, !!h);
    renderChips('insp-traits', who.traits, data.traitsById, 'chip');
    renderChips('insp-knows', who.knows ?? [], data.techsById, 'chip tech');
    $('insp-alive').classList.toggle('hidden', !h);
    if (dead) {
      $('insp-age').textContent = `Died on Day ${dateOf(dead.deathTick, data.config.time).day}`;
      $('insp-action').textContent = `Cause: ${dead.cause}`;
      $('insp-tools').textContent = '';
      $('insp-emotion-row').replaceChildren();
      $('insp-emotion-row').dataset.key = '';
      return true;
    }
    const expecting = h.pregnantUntil != null ? ', expecting a child' : '';
    $('insp-age').textContent = `Age ${humanAge(h, sim, data)}, ${lifeStage(h, sim, data)}${expecting}`;
    const carrying = h.carrying ? ` (carrying ${h.carrying.amount} ${h.carrying.type})` : '';
    $('insp-action').textContent = `${actionLabel(h)}${carrying}`;
    $('insp-tools').textContent = Object.keys(h.tools).length
      ? `Carries: ${Object.keys(h.tools).map((id) => data.itemsById[id].name.toLowerCase()).join(', ')}`
      : '';
    renderEmotion(h);
    renderStats(h);
    setNeed('bar-health', h.health);
    setNeed('bar-hunger', h.needs.hunger);
    setNeed('bar-energy', h.needs.energy);
    setNeed('bar-social', h.needs.social);
    setNeed('bar-mood', mood(h));
    $('bar-devotion').style.width = `${h.devotion}%`;
    renderThoughts(h);
    renderBonds(h);
    renderSkills(h);
    return true;
  }

  return { render };
}
