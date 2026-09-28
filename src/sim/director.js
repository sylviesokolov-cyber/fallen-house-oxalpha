import { logEvent } from './history.js';
import { dateOf } from './time.js';
import { foodInStock } from './items.js';
import { mood } from './mood.js';

// The storyteller. Once a day it reads how hard life is (deaths, hunger,
// sickness, crime, misery, empty stores) into a smoothed `tension`, and uses
// it to pace the events in data/events.json: after a long calm, trouble grows
// likelier; in the thick of a crisis the bad luck eases off and relief (a
// stranger, a good harvest) grows likelier. When a crisis passes, the age
// gets a name for the chronicle ("The Hungry Winter of Year 5").
//
// state.director: { tension, calmDays, crisis: { from, peak, causes } | null }
// state.eras: [{ name, from, to }]

export function newDirector() {
  return { tension: 0, calmDays: 0, crisis: null };
}

const DAY = (data) => data.config.time.ticksPerDay;

// Today's pressures, each in rough tension points.
function stresses(state, data) {
  const d = data.config.director;
  const n = Math.max(1, state.humans.length);
  const recent = (tick) => state.tick - tick < d.recentDays * DAY(data);
  const deaths = state.dead.filter((o) => o.cause !== 'exile' && recent(o.deathTick)).length;
  const hungry = state.humans.filter((h) => h.needs.hunger < 25).length / n;
  const sick = state.humans.filter((h) => h.sick).length / n;
  const crimes = (state.director.crimeLog ?? []).filter(recent).length;
  const unhappy = state.humans.filter((h) => mood(h) < 30).length / n;
  const empty = foodInStock(state, data) < n * d.lowFoodPerPerson ? 1 : 0;
  return {
    death: deaths * d.perDeath,
    hunger: (hungry * d.hunger) + empty * d.emptyStores,
    sickness: sick * d.sickness,
    crime: crimes * d.perCrime,
    misery: unhappy * d.misery,
  };
}

export function updateDirector(state, data) {
  if (state.tick % DAY(data) !== 0) return;
  const d = data.config.director;
  const dir = state.director;
  const s = stresses(state, data);
  const today = Object.values(s).reduce((a, b) => a + b, 0);
  dir.tension = Math.round((dir.tension * (1 - d.smoothing) + Math.min(100, today) * d.smoothing) * 10) / 10;
  dir.calmDays = dir.tension < d.calmBelow ? dir.calmDays + 1 : 0;
  if (!dir.crisis && dir.tension >= d.crisisAt) dir.crisis = { from: state.tick, peak: dir.tension, causes: {} };
  if (dir.crisis) {
    dir.crisis.peak = Math.max(dir.crisis.peak, dir.tension);
    for (const [k, v] of Object.entries(s)) dir.crisis.causes[k] = (dir.crisis.causes[k] ?? 0) + v;
    if (dir.tension < d.recoveredBelow) endCrisis(state, data);
  }
}

// How the storyteller scales an event's daily chance today.
export function eventWeight(state, data, kind) {
  const d = data.config.director;
  const dir = state.director;
  if (!dir) return 1;
  if (kind === 'bad') {
    if (dir.tension >= d.crisisAt) return d.badInCrisis;
    return 1 + Math.min(dir.calmDays, d.boredomDays) / d.boredomDays * (d.badWhenBored - 1);
  }
  if (kind === 'good') return dir.tension >= d.reliefAt ? d.goodInCrisis : 1;
  return 1;
}

const ERA_NAMES = {
  hunger: ['The Hungry', 'The Lean'],
  sickness: ['The Plague', 'The Fever'],
  death: ['The Black', 'The Mourning'],
  crime: ['The Lawless', 'The Troubled'],
  misery: ['The Bitter', 'The Grey'],
};

function endCrisis(state, data) {
  const c = state.director.crisis;
  state.director.crisis = null;
  const cause = Object.entries(c.causes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'misery';
  const date = dateOf(c.from, data.config.time);
  const words = ERA_NAMES[cause];
  const season = date.season === 'Winter' ? 'Winter' : date.season === 'Autumn' ? 'Autumn' : 'Days';
  const name = `${words[(state.eras ??= []).length % words.length]} ${season} of Year ${date.year}`;
  state.eras.push({ name, from: c.from, to: state.tick, cause });
  logEvent(state, `The hard times passed. They would be remembered as ${name}`);
}

// Crimes are noted for the storyteller (crime.js calls this).
export function noteCrime(state, data) {
  const log = (state.director.crimeLog ??= []);
  log.push(state.tick);
  const keep = data.config.director.recentDays * DAY(data);
  while (log.length && state.tick - log[0] >= keep) log.shift();
}
