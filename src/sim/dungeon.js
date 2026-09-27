import { next, randInt, chance } from './rng.js';
import { logEvent } from './history.js';
import { gainXp, skillLevel } from './skills.js';
import { wearTools } from './items.js';
import { feel } from './mood.js';
import { lifeStage } from './lifecycle.js';
import { killHuman } from './human.js';
import { changeBond } from './bonds.js';
import { castOf, fight, heroFighter, monsterFighters } from './combat.js';

// Expeditions through the portal. The player calls a party (see usePower):
// the members walk to the portal (h.called), step through together (h.away),
// and then clear one room every `roomTicks`, the last being the floor's boss.
// Inside, needs are on hold and wounds don't heal. After each room the party
// presses on or turns back (badly hurt, someone down, or the boss slain).
// A fallen hero can be carried home, but may bleed out on the way; one left
// with nobody standing is lost. Loot goes to the stockpile on return.
//
// state.expeditions: [{ id, floor, members, phase: called|inside|returning|done,
//   room, nextTick, reports: [{ title, lines, result }], loot, outcome }]

const d = (data) => data.dungeon;
const findHuman = (state, id) => state.humans.find((h) => h.id === id);

export function activeExpedition(state) {
  return state.expeditions.find((e) => e.phase !== 'done') ?? null;
}

// Why this person can't be sent, or null if they can.
export function cannotGo(state, data, h) {
  if (lifeStage(h, state, data) === 'child') return 'too young';
  if (h.pregnantUntil != null) return 'pregnant';
  if (h.away != null || h.called != null) return 'already called';
  if (h.punished) return 'serving a sentence';
  return null;
}

// The front of the portal, where the party gathers.
export function portalYard(data) {
  const p = data.sanctuary.portal;
  return { rx: p.x - 2, ry: p.y + p.h, w: p.w + 4, h: 2 };
}

// Returns an error message, or null once the party has been called.
export function callParty(state, data, memberIds, floorId) {
  if (activeExpedition(state)) return 'A party is already out';
  const floor = data.floorsById[floorId];
  if (!floor || floorId > state.dungeon.deepest) return 'That floor is still sealed';
  const ids = [...new Set(memberIds)];
  if (!ids.length) return 'Choose who to send';
  if (ids.length > d(data).maxParty) return `At most ${d(data).maxParty} can go`;
  const members = ids.map((id) => findHuman(state, id));
  if (members.some((h) => !h)) return 'Someone chosen is gone';
  for (const h of members) {
    const why = cannotGo(state, data, h);
    if (why) return `${h.name} can't go (${why})`;
  }
  const exp = {
    id: state.dungeon.nextId++,
    floor: floorId,
    members: ids,
    phase: 'called',
    calledTick: state.tick,
    room: 0,
    nextTick: 0,
    reports: [],
    loot: {},
    outcome: null,
  };
  state.expeditions.push(exp);
  for (const h of members) {
    h.called = exp.id;
    h.action = { type: 'idle', ticks: 0, done: true };
  }
  logEvent(state, `${listNames(members.map((h) => h.name))} ${members.length > 1 ? 'were' : 'was'} called to the portal`);
  return null;
}

// Orders the party inside to come home after the room they're in.
export function recallParty(state) {
  const exp = activeExpedition(state);
  if (!exp || exp.phase !== 'inside') return 'No party is inside';
  exp.recall = true;
  return null;
}

export function updateDungeon(state, data) {
  const exp = activeExpedition(state);
  if (!exp) return;
  const members = exp.members.map((id) => findHuman(state, id)).filter(Boolean);
  if (!members.length) return finish(state, data, exp, exp.phase === 'called' ? 'cancelled' : 'lost');
  if (exp.phase === 'called') updateCalled(state, data, exp, members);
  else if (exp.phase === 'inside' && state.tick >= exp.nextTick) nextRoom(state, data, exp, members);
  else if (exp.phase === 'returning' && state.tick >= exp.nextTick) comeHome(state, data, exp, members);
}

// Everyone steps through together once all have arrived; if some can't make
// it in time, those waiting go without them.
function updateCalled(state, data, exp, members) {
  const ready = members.filter((h) => h.action.type === 'atPortal');
  const late = state.tick - exp.calledTick > d(data).callTimeoutTicks;
  if (ready.length < members.length && !(late && ready.length)) {
    if (late) finish(state, data, exp, 'cancelled');
    return;
  }
  for (const h of members) {
    h.called = null;
    if (!ready.includes(h)) h.action.done = true;
  }
  exp.members = ready.map((h) => h.id);
  for (const h of ready) {
    h.away = exp.id;
    h.action = { type: 'away' };
    h.counters.expeditions = (h.counters.expeditions ?? 0) + 1;
  }
  // They take what remedies the store can spare, one each.
  exp.remedies = Math.min(state.stockpile.herbal_remedy ?? 0, ready.length);
  if (exp.remedies) state.stockpile.herbal_remedy -= exp.remedies;
  exp.phase = 'inside';
  exp.nextTick = state.tick + d(data).roomTicks;
  logEvent(state, `${listNames(ready.map((h) => h.name))} stepped through the portal into ${floorName(data, exp.floor)}`);
}

function rollMonsters(state, data, floor, boss) {
  if (boss) return [floor.boss];
  const n = randInt(state.rng, floor.group[0], floor.group[1]);
  const total = floor.monsters.reduce((s, m) => s + m.weight, 0);
  const ids = [];
  for (let k = 0; k < n; k++) {
    let r = next(state.rng) * total;
    ids.push(floor.monsters.find((m) => (r -= m.weight) < 0)?.id ?? floor.monsters[0].id);
  }
  return ids;
}

function nextRoom(state, data, exp, members) {
  const cfg = d(data);
  const floor = data.floorsById[exp.floor];
  exp.room++;
  const boss = exp.room > floor.rooms;
  const monsters = monsterFighters(data, rollMonsters(state, data, floor, boss));
  const heroes = members.filter((h) => h.health > 0).map((h) => heroFighter(h, data));
  const lines = [];
  const events = [];
  const cast = castOf(heroes, monsters);
  const { won } = fight(state, data, heroes, monsters, lines, events);
  const title = boss ? `Boss: ${monsters[0].name}` : `Room ${exp.room}: ${monsters.map((m) => m.name).join(', ')}`;
  const report = { title, lines: lines.slice(0, cfg.maxReportLines), events: events.slice(0, cfg.maxReportLines), cast, result: won ? 'cleared' : 'fled' };
  exp.reports.push(report);

  // Wounds, experience and loot.
  const xpEach = heroes.length ? monsters.filter((m) => m.hp <= 0).reduce((s, m) => s + data.monstersById[m.id].xp, 0) / heroes.length : 0;
  for (const f of heroes) {
    const h = findHuman(state, f.id);
    h.health = Math.max(0, (f.hp / f.maxHp) * 100);
    gainXp(state, data, h, f.style, f.attacks * cfg.xpPerAttack + xpEach);
    if (f.hitsTaken) gainXp(state, data, h, 'defense', f.hitsTaken * cfg.xpPerHitTaken);
    h.counters.kills = (h.counters.kills ?? 0) + f.kills.length;
    if (boss && won) h.counters.bossKills = (h.counters.bossKills ?? 0) + 1;
    wearTools(h, data, f.style);
    if (f.hitsTaken) wearTools(h, data, 'defense');
  }
  for (const m of monsters) if (m.hp <= 0) rollLoot(state, data, exp, data.monstersById[m.id]);
  // Fighting side by side draws people together.
  for (let i = 0; i < heroes.length; i++) {
    for (let j = i + 1; j < heroes.length; j++) {
      changeBond(state, data, findHuman(state, heroes[i].id), findHuman(state, heroes[j].id), cfg.bondPerRoom);
    }
  }

  const where = floorName(data, exp.floor);
  for (const f of heroes.filter((x) => x.dead)) {
    killHuman(state, data, findHuman(state, f.id), 'dungeon', `was slain by a ${f.killedBy} in ${where}`);
  }
  const up = heroes.filter((f) => !f.dead && !f.down);
  const down = heroes.filter((f) => f.down);
  if (!up.length) {
    for (const f of down) killHuman(state, data, findHuman(state, f.id), 'dungeon', `fell to a ${f.killedBy} in ${where}, with nobody left to carry them out`);
    report.result = 'lost';
    return finish(state, data, exp, 'lost');
  }
  if (boss && won) {
    report.result = 'victory';
    exp.outcome = 'victory';
    logEvent(state, `${listNames(up.map((f) => f.name))} slew the ${monsters[0].name} in ${where}!`);
    unlockNext(state, data, exp.floor, up.map((f) => f.name));
  }
  // The fallen are carried; the more hands, the better their chances, and a
  // remedy better still.
  const healer = up.map((f) => findHuman(state, f.id)).sort((a, b) => skillLevel(b, 'healing') - skillLevel(a, 'healing'))[0];
  for (const f of down) {
    let p = Math.min(0.9, cfg.carryOutBase + cfg.carryOutPerAlly * (up.length - 1));
    const h = findHuman(state, f.id);
    if (useRemedy(state, data, exp, healer, h, report)) p += cfg.remedySave;
    if (chance(state.rng, p)) {
      h.health = cfg.carriedOutHealth;
      h.carried = true;
      report.lines.push(`${f.name} is carried out, barely alive.`);
    } else {
      report.lines.push(`${f.name} bleeds out before they reach the portal.`);
      killHuman(state, data, h, 'dungeon', `was struck down by a ${f.killedBy} and died before reaching home`);
    }
  }
  for (const f of up) {
    const h = findHuman(state, f.id);
    if (h.health < cfg.remedyBelow * 100 && useRemedy(state, data, exp, healer, h, report)) {
      h.health = Math.min(100, h.health + cfg.remedyHeal);
      f.hp = (h.health / 100) * f.maxHp;
    }
  }
  const hurt = up.some((f) => f.hp < f.maxHp * cfg.retreatBelow);
  if (exp.outcome === 'victory' || down.length || !won || hurt || exp.recall) {
    if (!exp.outcome) exp.outcome = exp.recall ? 'recalled' : 'retreated';
    exp.phase = 'returning';
    exp.nextTick = state.tick + cfg.returnTicks;
    return;
  }
  exp.nextTick = state.tick + cfg.roomTicks;
}

function useRemedy(state, data, exp, healer, patient, report) {
  if (!exp.remedies) return false;
  exp.remedies--;
  report.lines.push(healer === patient ? `${patient.name} takes a herbal remedy.` : `${healer.name} gives ${patient.name} a herbal remedy.`);
  gainXp(state, data, healer, 'healing', data.skillsById.healing.xpPerAction);
  return true;
}

function rollLoot(state, data, exp, monster) {
  for (const l of monster.loot ?? []) {
    if (!chance(state.rng, l.chance)) continue;
    exp.loot[l.item] = (exp.loot[l.item] ?? 0) + randInt(state.rng, l.min, l.max);
  }
}

function unlockNext(state, data, floorId, names = []) {
  const first = !state.dungeon.cleared.includes(floorId);
  if (first) state.dungeon.cleared.push(floorId);
  // The last floor: the dungeon is conquered.
  if (first && !data.floorsById[floorId + 1]) {
    state.dungeon.conquered = state.tick;
    const boss = data.monstersById[data.floorsById[floorId].boss].name;
    logEvent(state, `The ${boss} has fallen! ${listNames(names)} conquered the dungeon beneath ${state.settlement.name}, and songs of it will be sung for ever`);
  }
  const nextFloor = data.floorsById[floorId + 1];
  if (nextFloor && state.dungeon.deepest === floorId) {
    state.dungeon.deepest = floorId + 1;
    logEvent(state, `The way to Floor ${nextFloor.id}, ${nextFloor.name}, lies open`);
  }
}

// Back through the portal: into the yard in front of it, loot to the store.
function comeHome(state, data, exp, members) {
  const yard = portalYard(data);
  members.forEach((h, i) => {
    h.away = null;
    h.x = h.prevX = yard.rx + (i % yard.w);
    h.y = h.prevY = yard.ry + Math.floor(i / yard.w) % yard.h;
    h.action = { type: 'idle', ticks: 4 };
    if (h.carried) feel(state, data, h, 'nearDeath', 'Nearly died in the dungeon');
    else if (exp.outcome === 'victory') feel(state, data, h, 'dungeonVictory', `Victory in ${floorName(data, exp.floor)}`);
    else feel(state, data, h, 'dungeonReturn', 'Came home from the dungeon');
    delete h.carried;
  });
  for (const [item, n] of Object.entries(exp.loot)) {
    state.stockpile[item] = (state.stockpile[item] ?? 0) + n;
    state.tribeCounters[`loot:${item}`] = (state.tribeCounters[`loot:${item}`] ?? 0) + n;
  }
  if (exp.remedies) state.stockpile.herbal_remedy += exp.remedies;
  exp.remedies = 0;
  const loot = Object.entries(exp.loot).map(([item, n]) => `${n} ${data.itemsById[item].name.toLowerCase()}`);
  logEvent(state, `${listNames(members.map((h) => h.name))} came home from ${floorName(data, exp.floor)}${loot.length ? ` with ${listNames(loot)}` : ''}`);
  finish(state, data, exp, exp.outcome ?? 'returned');
}

function finish(state, data, exp, outcome) {
  exp.phase = 'done';
  exp.outcome = outcome;
  exp.endTick = state.tick;
  for (const id of exp.members) {
    const h = findHuman(state, id);
    if (h?.called === exp.id) {
      h.called = null;
      h.action.done = true;
    }
  }
  if (outcome === 'lost') logEvent(state, `The party sent into ${floorName(data, exp.floor)} never came back`);
  if (outcome === 'cancelled') logEvent(state, 'Nobody reached the portal in time; the call went unanswered');
  const done = state.expeditions.filter((e) => e.phase === 'done');
  const extra = done.length - d(data).keepExpeditions;
  if (extra > 0) state.expeditions = state.expeditions.filter((e) => !done.slice(0, extra).includes(e));
}

export function floorName(data, id) {
  const name = data.floorsById[id].name;
  return name.startsWith('The ') ? `the ${name.slice(4)}` : `the ${name}`;
}

export function listNames(names) {
  return names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}
