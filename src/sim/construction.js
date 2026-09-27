import { logEvent } from './history.js';
import { feel } from './mood.js';
import { buildingEffect, sleepCapacity } from './buildings.js';

// New buildings go up on the fixed plots from sanctuary.json (family houses on
// the smaller home plots). Anyone who knows construction, and the building's
// own tech, can start one when it's wanted and the stockpile can pay for it:
// the materials are taken at once and the frame becomes a construction site
// (built: false) that people finish with work. Upgrades work the same way on
// a finished building (b.upgrade = { level, work }).

const knowsTech = (h, tech) => !tech || h.knows.includes(tech);
const affordable = (stockpile, cost) => Object.entries(cost).every(([k, v]) => (stockpile[k] ?? 0) >= v);

function plotsOf(data, def) {
  return def.plot === 'home' ? data.sanctuary.homePlots : data.sanctuary.plots;
}

// Plot keys look like "plot:3" or "home:0".
function freePlot(state, data, def) {
  const kind = def.plot ?? 'plot';
  const used = new Set(state.buildings.map((b) => b.plot));
  const i = plotsOf(data, def).findIndex((_, n) => !used.has(`${kind}:${n}`));
  return i < 0 ? null : { key: `${kind}:${i}`, rect: plotsOf(data, def)[i] };
}

export function freePlotCount(state, data, kind = 'plot') {
  const list = kind === 'home' ? data.sanctuary.homePlots : data.sanctuary.plots;
  const used = new Set(state.buildings.map((b) => b.plot));
  return list.filter((_, n) => !used.has(`${kind}:${n}`)).length;
}

export function nextUpgrade(data, b) {
  return data.buildingsById[b.type].upgrades?.find((u) => u.level === b.level + 1) ?? null;
}

const isOwner = (state, id) => state.buildings.some((b) => b.owners?.includes(id));

// Partnered pairs where neither partner owns a home yet.
export function homelessCouples(state) {
  const out = [];
  for (const a of state.humans) {
    if (a.partnerId == null || a.partnerId < a.id) continue;
    const b = state.humans.find((o) => o.id === a.partnerId);
    if (b && !isOwner(state, a.id) && !isOwner(state, b.id)) out.push([a, b]);
  }
  return out;
}

function wantsBuilding(state, def) {
  const mine = state.buildings.filter((b) => b.type === def.id);
  if (def.want.couples) {
    const waiting = mine.filter((b) => !b.built || !b.owners?.length).length;
    return homelessCouples(state).length > waiting;
  }
  return mine.length < (def.want.count ?? 0);
}

// More beds are only wanted once the halls are nearly full; other upgrades
// are always welcome.
function wantsUpgrade(state, data, u) {
  if (u.effects.sleepers) return state.humans.length >= sleepCapacity(state, data) - 2;
  return true;
}

// A site or upgrade already underway that this person can help with.
export function openJobFor(state, data, h) {
  if (!h.knows.includes('construction')) return null;
  return state.buildings.find((b) => (!b.built && knowsTech(h, data.buildingsById[b.type].tech))
    || (b.upgrade && knowsTech(h, nextUpgrade(data, b)?.tech))) ?? null;
}

// Something new this person could start: a wanted building on a free plot,
// or else an upgrade. Starting buildings come first, in data order.
export function planJob(state, data, h) {
  if (!h.knows.includes('construction')) return null;
  for (const def of data.buildings) {
    if (!def.cost || !knowsTech(h, def.tech) || !affordable(state.stockpile, def.cost)) continue;
    if (wantsBuilding(state, def) && freePlot(state, data, def)) return { def };
  }
  for (const b of state.buildings) {
    const u = b.built && !b.upgrade && nextUpgrade(data, b);
    if (u && knowsTech(h, u.tech) && affordable(state.stockpile, u.cost) && wantsUpgrade(state, data, u)) return { b, u };
  }
  return null;
}

function pay(state, cost) {
  for (const [k, v] of Object.entries(cost)) state.stockpile[k] -= v;
}

// Lays out a planned job and returns the building to work on.
export function startJob(state, data, h, job) {
  if (job.u) {
    pay(state, job.u.cost);
    job.b.upgrade = { level: job.u.level, work: 0 };
    logEvent(state, `${h.name} began upgrading the ${data.buildingsById[job.b.type].name}`);
    return job.b;
  }
  const { def } = job;
  const plot = freePlot(state, data, def);
  pay(state, def.cost);
  const r = plot.rect;
  const b = {
    id: state.nextBuildingId++,
    type: def.id,
    level: 1,
    built: false,
    work: 0,
    plot: plot.key,
    builders: [],
    rx: r.x,
    ry: r.y,
    w: r.w,
    h: r.h,
    x: r.x + Math.floor(r.w / 2),
    y: r.y + Math.floor(r.h / 2),
  };
  state.buildings.push(b);
  logEvent(state, `${h.name} began building a ${def.name}`);
  return b;
}

// Progress on a site or upgrade as a fraction (0-1), or null if there's none.
export function jobProgress(data, b) {
  if (!b.built) return b.work / data.buildingsById[b.type].work;
  if (b.upgrade) return b.upgrade.work / nextUpgrade(data, b).work;
  return null;
}

// Adds work to a site or upgrade, finishing it when enough is done.
// Returns true if this work finished it.
export function addWork(state, data, h, b, amount) {
  const def = data.buildingsById[b.type];
  if (!b.built) {
    if (!b.builders.includes(h.id)) b.builders.push(h.id);
    b.work += amount;
    if (b.work < def.work) return false;
    b.built = true;
    delete b.work;
    const names = b.builders.map((id) => state.humans.find((o) => o.id === id)?.name).filter(Boolean);
    delete b.builders;
    logEvent(state, `The ${def.name} was finished${names.length ? `, built by ${listNames(names)}` : ''}`);
    updateHomes(state, data);
    return true;
  }
  if (!b.upgrade) return false;
  b.upgrade.work += amount;
  if (b.upgrade.work < nextUpgrade(data, b).work) return false;
  b.level = b.upgrade.level;
  delete b.upgrade;
  logEvent(state, `The ${def.name} was upgraded to level ${b.level}`);
  return true;
}

function listNames(names) {
  return names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

// Homes whose owners have all died pass to a couple without one, and a new
// house goes to the first couple waiting. Checked daily and on completion.
export function updateHomes(state, data) {
  for (const b of state.buildings) {
    if (!buildingEffect(data, b, 'home')) continue;
    b.owners = (b.owners ?? []).filter((id) => state.humans.some((o) => o.id === id));
    if (b.owners.length) continue;
    const couple = homelessCouples(state)[0];
    if (!couple) continue;
    b.owners = couple.map((p) => p.id);
    const name = data.buildingsById[b.type].name;
    logEvent(state, `${couple[0].name} and ${couple[1].name} moved into a ${name} of their own`);
    for (const p of couple) feel(state, data, p, 'newHome', 'Moved into a home of our own');
  }
}
