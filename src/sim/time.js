// Time units: tick -> day -> season -> year. Days are counted from 0 internally
// and shown from 1.

export function dayIndexOf(tick, t) {
  return Math.floor(tick / t.ticksPerDay);
}

export function daysPerYear(t) {
  return t.daysPerSeason * t.seasons.length;
}

export function dateOf(tick, t) {
  const dayIndex = dayIndexOf(tick, t);
  const dayOfYear = dayIndex % daysPerYear(t);
  return {
    day: dayIndex + 1,
    year: Math.floor(dayIndex / daysPerYear(t)) + 1,
    season: t.seasons[Math.floor(dayOfYear / t.daysPerSeason)],
  };
}

// birthDay is a day index; it is negative for people born before the game began.
export function ageInYears(birthDay, tick, t) {
  return Math.floor((dayIndexOf(tick, t) - birthDay) / daysPerYear(t));
}
