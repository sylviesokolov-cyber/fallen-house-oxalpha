const clamp = (v) => Math.max(0, Math.min(100, v));

// Needs are satisfaction levels: 100 = fully satisfied, 0 = desperate.
// An empty stomach drains health; health slowly recovers when fed.
// Cold winters burn through food faster.
export function updateNeeds(h, cfg, season) {
  const sleeping = h.action.type === 'sleep';
  const seasonMult = season === 'Winter' ? cfg.hunger.winterMultiplier : 1;
  h.needs.hunger = clamp(h.needs.hunger - cfg.hunger.decay * seasonMult * (sleeping ? cfg.hunger.sleepFactor : 1));
  if (!sleeping) h.needs.energy = clamp(h.needs.energy - cfg.energy.decay);

  if (h.needs.hunger <= 0) h.health = clamp(h.health - cfg.health.starveDamage);
  else if (h.needs.hunger > cfg.health.regenAboveHunger) h.health = clamp(h.health + cfg.health.regen);
}
