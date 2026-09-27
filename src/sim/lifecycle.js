import { chance, next, randInt } from './rng.js';
import { ageInYears, dayIndexOf } from './time.js';
import { createHuman, killHuman } from './human.js';
import { changeBond } from './bonds.js';
import { logEvent } from './history.js';
import { rollTraits } from './traits.js';
import { addFeeling } from './mood.js';
import { inheritGrade, gradeOf } from './stats.js';
import { populationCap } from './settlement.js';
import { foodInStock, foodReserveWanted } from './items.js';
import { focusValue } from './status.js';

export function lifeStage(h, state, data) {
  const age = ageInYears(h.birthDay, state.tick, data.config.time);
  const l = data.config.lifecycle;
  if (age < l.adultAge) return 'child';
  // The gods' gift of eternal youth: they never grow old.
  if (age >= l.elderAge && !h.eternal) return 'elder';
  return 'adult';
}

const findHuman = (state, id) => state.humans.find((h) => h.id === id);

// Runs once per in-game day: coming of age, births, conceptions, old age.
export function updateLifeCycle(state, data) {
  const cfg = data.config;
  if (state.tick % cfg.time.ticksPerDay !== 0) return;
  const l = cfg.lifecycle;
  const today = dayIndexOf(state.tick, cfg.time);

  for (const h of [...state.humans]) {
    const age = ageInYears(h.birthDay, state.tick, cfg.time);
    if (age === l.adultAge && !h.cameOfAge) {
      h.cameOfAge = true;
      logEvent(state, `${h.name} came of age`);
    }
    if (h.pregnantUntil != null && today >= h.pregnantUntil) giveBirth(state, data, h);
    else if (canConceive(state, data, h) && chance(state.rng, l.birthChancePerDay * focusValue(state, data, 'birth'))) {
      h.pregnantUntil = today + l.gestationDays;
    }
    if (!h.eternal && age >= l.oldAgeStart && chance(state.rng, oldAgeRisk(age, l) / (cfg.time.daysPerSeason * cfg.time.seasons.length))) {
      killHuman(state, data, h, 'old age');
    }
  }
}

// Yearly chance of dying of old age grows each year past oldAgeStart.
function oldAgeRisk(age, l) {
  return l.oldAgeBaseYearly * l.oldAgeGrowth ** (age - l.oldAgeStart);
}

function canConceive(state, data, h) {
  const l = data.config.lifecycle;
  if (h.sex !== 'female' || h.pregnantUntil != null || !h.partnerId) return false;
  if (state.humans.length >= populationCap(state, data)) return false;
  // Nobody starts a family while the stores are nearly bare, or while there
  // are already more children than grown-ups to feed them.
  if (foodInStock(state, data) < foodReserveWanted(state, data) * l.foodSecureFraction) return false;
  const kids = state.humans.filter((o) => lifeStage(o, state, data) === 'child').length;
  if (kids >= (state.humans.length - kids) * l.childrenPerAdult) return false;
  const partner = findHuman(state, h.partnerId);
  if (!partner || partner.sex !== 'male') return false;
  const today = dayIndexOf(state.tick, data.config.time);
  if (h.lastBirthDay != null && today - h.lastBirthDay < l.birthCooldownDays) return false;
  const age = ageInYears(h.birthDay, state.tick, data.config.time);
  return lifeStage(h, state, data) !== 'child' && lifeStage(partner, state, data) !== 'child'
    && age <= l.fertileMaxAge && h.needs.hunger > l.fedAbove && partner.needs.hunger > l.fedAbove;
}

function giveBirth(state, data, mother) {
  const father = state.humans.find((h) => h.id === mother.partnerId) ?? state.dead.find((h) => h.id === mother.partnerId);
  // Children take their father's house, unless their mother rules.
  const rulesHouse = state.settlement.leaderId === mother.id;
  const child = createHuman(state, data, mother.x, mother.y, {
    ageYears: 0,
    house: rulesHouse ? mother.house : father?.house ?? mother.house,
    parentsList: [mother, father].filter(Boolean),
    parents: [mother.id, father?.id].filter((id) => id != null),
    traits: inheritTraits(state, data, mother, father),
    grade: inheritGrade(state, data, [mother, father].filter(Boolean)),
  });
  state.humans.push(child);
  state.tribeCounters.births = (state.tribeCounters.births ?? 0) + 1;
  mother.pregnantUntil = null;
  mother.lastBirthDay = dayIndexOf(state.tick, data.config.time);
  const familyBond = data.config.social.familyBond;
  const m = data.config.mood;
  for (const parent of [mother, father]) {
    if (!parent || !state.humans.includes(parent)) continue;
    changeBond(state, data, parent, child, familyBond);
    addFeeling(state, data, parent, `Welcomed ${child.name}`, m.joyValue, m.joyDays);
  }
  const word = child.sex === 'female' ? 'daughter' : 'son';
  logEvent(state, father
    ? `${mother.name} and ${father.name} had a ${word}, ${child.name}`
    : `${mother.name} had a ${word}, ${child.name}`);
  if (child.grade >= 4) {
    logEvent(state, `${child.name} was born with ${gradeOf(data, child.grade).name.toLowerCase()} promise (${'★'.repeat(child.grade)})`);
  }
}

// Each parent trait has an even chance of passing on; a child always ends up
// with 1-3 traits and never two opposites.
function inheritTraits(state, data, mother, father) {
  const max = data.config.humans.traitsMax;
  const traits = [];
  for (const id of [...mother.traits, ...(father?.traits ?? [])]) {
    if (traits.length >= max || traits.includes(id)) continue;
    if (traits.includes(data.traitsById[id].opposite)) continue;
    if (next(state.rng) < 0.5) traits.push(id);
  }
  if (!traits.length) {
    const fresh = rollTraits(state, data);
    traits.push(fresh[randInt(state.rng, 0, fresh.length - 1)]);
  }
  return traits;
}
