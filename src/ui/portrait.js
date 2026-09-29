import { gradeOf } from '../sim/stats.js';
import { el } from './dom.js';
import { spriteLayers, spriteNode } from './spriteArt.js';
import { emotionOf } from '../sim/emotions.js';
import { rankIndex } from '../sim/rank.js';
import { dateOf } from '../sim/time.js';
import { skillLevel } from '../sim/skills.js';

// A portrait matching the map sprite, drawn as SVG: shoulders in their tunic
// with a sash in their house colour, face, hair style and beard, framed in
// the colour of their grade. `marks` adds a crown (the ruler) or a tiara
// (the ruler's spouse or heir); the ageless get a halo.

const HAIR_FRONT = {
  short: 'M19 26c0-9 6-14 13-14s13 5 13 14c-3-4-7-6-13-6s-10 2-13 6z',
  spiky: 'M18 27l2-8-3-2 5-1 1-5 4 3 5-4 3 4 5-2v5l5 2-3 3 1 5c-4-4-8-5-13-5s-9 1-12 5z',
  shaggy: 'M18 30c-1-11 6-18 14-18s15 7 14 18l-3-5-2 4-3-6-3 4-3-5-3 5-3-4-2 5z',
  long: 'M18 30c0-11 6-18 14-18s14 7 14 18c-2-6-7-10-14-10s-12 4-14 10z',
  braid: 'M18 29c0-10 6-17 14-17s14 7 14 17c-2-5-7-9-14-9s-12 4-14 9z',
  bun: 'M19 27c0-9 6-14 13-14s13 5 13 14c-3-4-7-6-13-6s-10 2-13 6z',
  bald: 'M19 28c0-2 1-3 2-3v4zM45 28c0-2-1-3-2-3v4z',
};
const HAIR_BACK = {
  long: 'M17 30c0-10 6-17 15-17s15 7 15 17v18c-3 2-6 2-8 0V34H25v14c-2 2-5 2-8 0z',
  braid: 'M41 30c4 4 6 10 5 18l-3 1c0-6-1-11-4-15z',
  bun: 'M32 5a6 6 0 1 1 0 12a6 6 0 1 1 0-12z',
};
const SHOULDERS = { slim: 'M17 64c0-11 6-17 15-17s15 6 15 17z', normal: 'M13 64c0-12 8-18 19-18s19 6 19 18z', broad: 'M8 64c0-13 10-19 24-19s24 6 24 19z' };

const CROWN = '<svg class="p-crown" viewBox="0 0 40 24"><path d="M3 22l3-17 8 8 6-11 6 11 8-8 3 17z" fill="#f2c14e" stroke="#8a5a10" stroke-width="1.5"/><circle cx="20" cy="15" r="2.6" fill="#e03a5a"/></svg>';
const TIARA = '<svg class="p-crown tiara" viewBox="0 0 40 16"><path d="M4 14q16-14 32 0l-3 1q-13-9-26 0z" fill="#e8eef8" stroke="#8a93a6" stroke-width="1"/><circle cx="20" cy="6" r="2.4" fill="#6ab0ff"/></svg>';

export function portrait(look, who, stage, alive, data, marks = {}) {
  const frame = el('div', `portrait-frame${alive ? '' : ' dead'}${stage === 'child' ? ' child' : ''}`);
  const grade = gradeOf(data, who.grade).color;
  frame.style.borderColor = grade === '#1b1b1b' ? '#5c6878' : grade;
  // Grown women get the anime sprite; everyone else the drawn face below.
  if (who.sex === 'female' && stage !== 'child') {
    frame.classList.add('has-sprite');
    frame.append(spriteNode(spriteLayers(look, marks.mood ?? { id: who.id, looks: who.looks, traits: who.traits })));
    if (marks.crown || marks.tiara) frame.insertAdjacentHTML('beforeend', marks.crown ? CROWN : TIARA);
    return frame;
  }
  const child = stage === 'child';
  const style = look.hairStyle ?? (look.longHair ? 'long' : 'short');
  const beard = look.beard && !child;
  const cheeks = look.beauty >= 7 ? `<ellipse cx="24.5" cy="33" rx="2.6" ry="1.5" fill="#ff8a8a" opacity=".35"/><ellipse cx="39.5" cy="33" rx="2.6" ry="1.5" fill="#ff8a8a" opacity=".35"/>` : '';
  const lashes = who.sex === 'female' ? '<path d="M24 27.5l-1.5-1.2M40 27.5l1.5-1.2" stroke="#1b1b1b" stroke-width="1"/>' : '';
  const svg = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    ${who.eternal ? '<ellipse cx="32" cy="10" rx="14" ry="4" fill="none" stroke="#ffe27a" stroke-width="2.2" opacity=".9"/>' : ''}
    ${HAIR_BACK[style] ? `<path d="${HAIR_BACK[style]}" fill="${look.hair}"/>` : ''}
    <path d="${SHOULDERS[look.build ?? 'normal']}" fill="${look.tunic}"/>
    <path d="M22 50c3 3 6 4 10 4s7-1 10-4" stroke="rgba(0,0,0,.18)" stroke-width="2" fill="none"/>
    ${look.sash ? `<path d="M${look.build === 'broad' ? 14 : 18} 52l24 12h8L${look.build === 'broad' ? 20 : 23} 48z" fill="${look.sash}" opacity=".95"/>` : ''}
    <rect x="28" y="38" width="8" height="9" rx="3" fill="${look.skin}"/>
    <ellipse cx="19.5" cy="29" rx="2.5" ry="3.5" fill="${look.skin}"/><ellipse cx="44.5" cy="29" rx="2.5" ry="3.5" fill="${look.skin}"/>
    <ellipse cx="32" cy="28" rx="12.5" ry="13.5" fill="${look.skin}"/>
    <path d="M22 33c3 7 7 9 10 9s7-2 10-9" fill="rgba(0,0,0,.07)"/>
    ${beard ? `<path d="M20 30c1 10 6 15 12 15s11-5 12-15c-2 4-4 5-6 5-1-2-4-3-6-3s-5 1-6 3c-2 0-4-1-6-5z" fill="${look.hair}"/>` : ''}
    <ellipse cx="26.5" cy="29" rx="2" ry="2.4" fill="#fff"/><ellipse cx="37.5" cy="29" rx="2" ry="2.4" fill="#fff"/>
    <circle cx="26.8" cy="29.4" r="1.5" fill="${look.eyes ?? '#3b2a1a'}"/><circle cx="37.8" cy="29.4" r="1.5" fill="${look.eyes ?? '#3b2a1a'}"/>
    <circle cx="27.3" cy="28.8" r=".5" fill="#fff"/><circle cx="38.3" cy="28.8" r=".5" fill="#fff"/>${lashes}
    <path d="M23.5 25.3q3-1.6 6 0M34.5 25.3q3-1.6 6 0" stroke="${look.hair}" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    <path d="M31 31.5q1 2 2 0" stroke="rgba(0,0,0,.25)" stroke-width="1" fill="none"/>
    ${beard ? '' : '<path d="M28.5 36q3.5 2.5 7 0" stroke="#8a3a3a" stroke-width="1.3" fill="none" stroke-linecap="round"/>'}
    ${cheeks}
    <path d="${HAIR_FRONT[style]}" fill="${look.hair}"/>
    ${style === 'braid' ? `<path d="M42 36l2 3-2 3 2 3-2 3" stroke="${look.hair}" stroke-width="3.5" fill="none"/>` : ''}
    ${marks.crown ? '<path d="M21 17l3-9 4 5 4-7 4 7 4-5 3 9z" fill="#f2c14e" stroke="#8a5a10" stroke-width="1"/><circle cx="32" cy="13" r="1.6" fill="#e03a5a"/>' : ''}
    ${marks.tiara ? '<path d="M23 16q9-5 18 0l-2 2q-7-3-14 0z" fill="#e8eef8" stroke="#8a93a6" stroke-width=".6"/><circle cx="32" cy="13.5" r="1.3" fill="#6ab0ff"/>' : ''}
  </svg>`;
  frame.innerHTML = svg;
  return frame;
}

// Crown for the ruler, tiara for their spouses and heir; and for the anime
// sprites, what she's feeling and doing (`mood`). Pass `data` for the mood.
export function royalMarks(sim, h, data = null) {
  const ruler = sim.humans.find((o) => o.id === sim.settlement.leaderId);
  const marks = {};
  if (ruler && h.id === ruler.id) marks.crown = true;
  else if (ruler && (h.id === sim.dynasty.heirId || h.partnerId === ruler.id || ruler.partnerId === h.id)) marks.tiara = true;
  if (data && h.sex === 'female') {
    marks.mood = {
      id: h.id,
      emotion: emotionOf(h, data).id,
      rank: rankIndex(sim, data, h),
      royal: !!(marks.crown || marks.tiara),
      action: h.action?.type === 'sleep' || h.action?.type === 'recover' ? 'sleep' : h.action?.type,
      season: dateOf(sim.tick, data.config.time).season,
      traits: h.traits,
      research: skillLevel(h, 'research'),
      looks: h.looks,
    };
  }
  return marks;
}
