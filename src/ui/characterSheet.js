import { ageInYears, dateOf } from '../sim/time.js';
import { appearance } from '../render/appearance.js';
import { humanAge } from '../sim/human.js';
import { xpToNext } from '../sim/skills.js';
import { bondValue, relationType } from '../sim/bonds.js';
import { lifeStage } from '../sim/lifecycle.js';
import { mood } from '../sim/mood.js';
import { isBlessed, isInspired } from '../sim/status.js';
import { emotionOf } from '../sim/emotions.js';
import { gradeOf, heroClass, xpForLevel } from '../sim/stats.js';
import { rankOf } from '../sim/settlement.js';
import { looksLabel } from '../sim/appeal.js';
import { createDivineActions } from './divineActions.js';
import { combatPower } from '../sim/combat.js';
import { $, el, bar, button, stars, renderKeyed } from './dom.js';
import { portrait } from './portrait.js';

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
  pray: 'Praying',
  train: 'Training',
  study: 'Studying in the Library',
  toPortal: 'Answering the call to the portal',
  recover: 'Resting in the Infirmary',
  arcane: 'Practising magic in the Mage Tower',
  atPortal: 'Waiting at the portal',
  drink: 'Having a drink at the Tavern',
};
const TIER_LABELS = { closeFriend: 'Close friend', friend: 'Friend', acquaintance: 'Acquaintance', rival: 'Rival' };
const MAX_BONDS_SHOWN = 7;

export function createCharacterSheet(ctx, { toast, select }) {
  const divine = createDivineActions(ctx, { toast });
  // Tabs: Status, Skills, People, Story.
  for (const b of document.querySelectorAll('.sheet-tabs button')) {
    b.addEventListener('click', () => {
      for (const t of document.querySelectorAll('.sheet-tabs button')) t.classList.toggle('active', t === b);
      for (const s of document.querySelectorAll('.sheet-tab')) s.classList.toggle('hidden', s.dataset.sheet !== b.dataset.sheet);
    });
  }

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
    const place = a.buildingId != null ? sim.buildings.find((b) => b.id === a.buildingId) : null;
    const placeName = place && data.buildingsById[place.type].name;
    if (a.type === 'craft') {
      const item = data.itemsById[a.itemId];
      const verb = item.kind === 'meal' ? 'Cooking' : item.kind === 'drink' ? 'Brewing' : 'Making';
      return `${verb} ${item.name.toLowerCase()}`;
    }
    if (a.type === 'build' && place) return place.built ? `Upgrading the ${placeName}` : `Building the ${placeName}`;
    if (a.type === 'pray' && place) return `Praying in the ${placeName}`;
    if (a.type === 'away') {
      const exp = sim.expeditions.find((e) => e.id === h.away);
      return exp ? `In the dungeon: Floor ${exp.floor}, ${data.floorsById[exp.floor].name}` : 'In the dungeon';
    }
    if (a.type === 'seekFood' && a.dine) return 'Going to the Dining Hall';
    if (a.type === 'seekFood' && a.stock) return 'Going to the store for potatoes';
    if (a.type === 'eat' && a.dine) return 'Having a meal in the Dining Hall';
    if (a.type === 'eat' && !a.stock && !a.fromCarry) return 'Eating raw potatoes in the field';
    if (a.type === 'train' && lifeStage(h, sim, data) === 'child') return 'Playing at the Training Ground';
    if (a.type === 'sleep' && place) return place.owners ? 'Sleeping at home' : `Sleeping in the ${placeName}`;
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
    const rank = alive ? rankOf(sim, data, who) : null;
    const puppet = alive && sim.dynasty.puppetId === who.id && sim.settlement.leaderId === who.id;
    $('insp-leader').textContent = rank ? `${rank}${puppet ? ' · your puppet' : ''}` : '';
    const drawn = alive && who.drawnTo ? ` · drawn to ${data.config.appeal.preferences[who.drawnTo].toLowerCase()}` : '';
    $('insp-house').textContent = who.house
      ? `House ${who.house} · ${looksLabel(who)}${drawn}${who.eternal ? ' · ageless' : ''}`
      : '';
    const stage = alive ? lifeStage(who, sim, data) : 'adult';
    const look = appearance(who, stage === 'elder');
    renderKeyed($('insp-portrait'), `${who.id}|${look.tunic}|${look.hair}|${stage}|${alive}`, () => [portrait(look, who, stage, alive, data)]);
  }

  // The newest chapters first, each with the age they were then.
  function renderStory(who) {
    const { data } = ctx;
    const story = who.story ?? [];
    renderKeyed($('insp-story'), `${who.id}:${story.length}:${story.at(-1)?.tick}`, () => {
      if (!story.length) return [el('li', 'empty', 'Their story has yet to be written.')];
      return story.slice().reverse().map((e) => {
        const li = el('li');
        li.append(el('span', 'story-age', `Age ${Math.max(0, ageInYears(who.birthDay, e.tick, data.config.time))}`), el('span', null, e.text));
        return li;
      });
    });
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
    renderStory(who);
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
    const tools = Object.keys(h.tools).length
      ? `Carries: ${Object.keys(h.tools).map((id) => data.itemsById[id].name.toLowerCase()).join(', ')}. `
      : '';
    const c = h.counters;
    const trips = c.expeditions ? ` · ${c.expeditions} expedition${c.expeditions > 1 ? 's' : ''}, ${c.kills ?? 0} kills${c.bossKills ? `, ${c.bossKills} bosses` : ''}` : '';
    $('insp-tools').textContent = `${tools}Combat power ${combatPower(h, data)}${trips}`;
    renderEmotion(h);
    divine.render(h);
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
