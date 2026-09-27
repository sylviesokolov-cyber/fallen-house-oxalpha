import { mood } from './mood.js';

// A person's current emotion, worked out from their needs, mood and feelings.
// Emotions (data/emotions.json) nudge behaviour: how keen they are to work,
// socialize, learn, or pick a fight.
export function emotionOf(h, data) {
  const e = data.emotionsById;
  if (h.needs.hunger < 15) return e.starving;
  if (h.feelings.some((f) => f.kind === 'grief')) return e.grieving;
  if (h.feelings.some((f) => f.kind === 'anger')) return e.angry;
  if (h.needs.social < 20) return e.lonely;
  const m = mood(h);
  if (m >= 92) return e.joyful;
  if (m >= 75) return e.happy;
  if (m >= 45) return e.content;
  if (m >= 25) return e.sad;
  return e.miserable;
}

export function emotionEffect(h, data, key) {
  return emotionOf(h, data).effects[key] ?? 1;
}
