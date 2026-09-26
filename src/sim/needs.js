import { traitMod } from './traits.js';

const clamp = (v) => Math.max(0, Math.min(100, v));

// Needs are satisfaction levels: 100 = fully satisfied, 0 = desperate.
// An empty stomach drains health; health slowly recovers when fed.
// Cold winters burn through food faster; traits speed up or slow down decay.
export function updateNeeds(h, data, season) {
  const cfg = data.config.needs;
  const sleeping = h.action.type === 'sleep';
  const seasonMult = season === 'Winter' ? cfg.hunger.winterMultiplier : 1;
  const hungerDecay = cfg.hunger.decay * seasonMult * traitMod(h, data, 'hungerDecay');
  h.needs.hunger = clamp(h.needs.hunger - hungerDecay * (sleeping ? cfg.hunger.sleepFactor : 1));
  if (!sleeping) h.needs.energy = clamp(h.needs.energy - cfg.energy.decay * traitMod(h, data, 'energyDecay'));

  if (h.needs.hunger <= 0) h.health = clamp(h.health - cfg.health.starveDamage);
  else if (h.needs.hunger > cfg.health.regenAboveHunger) h.health = clamp(h.health + cfg.health.regen);
}
