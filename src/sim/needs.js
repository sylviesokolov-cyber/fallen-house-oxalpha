const clamp = (v) => Math.max(0, Math.min(100, v));

// Needs are satisfaction levels: 100 = fully satisfied, 0 = desperate.
// An empty stomach drains health; health slowly recovers when fed.
export function updateNeeds(h, cfg) {
  const sleeping = h.action.type === 'sleep';
  h.needs.hunger = clamp(h.needs.hunger - cfg.hunger.decay * (sleeping ? cfg.hunger.sleepFactor : 1));
  if (!sleeping) h.needs.energy = clamp(h.needs.energy - cfg.energy.decay);

  if (h.needs.hunger <= 0) h.health = clamp(h.health - cfg.health.starveDamage);
  else if (h.needs.hunger > cfg.health.regenAboveHunger) h.health = clamp(h.health + cfg.health.regen);
}
