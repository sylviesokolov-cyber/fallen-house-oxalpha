import { el } from './dom.js';

// Anime portraits for grown men and women, assembled from Sutemo's layered
// sprites (assets/sprites/male, assets/sprites/female): back hair, body,
// blush, outfit, front hair, expression and accessories, stacked in that
// order. Every layer of a set is the same size and lines up, so a portrait
// is just a pile of images. What's chosen comes from who they are: their
// hair (from appearance.js), rank, mood, what they're doing, the season and
// their traits.

const pick = (list, k) => (Array.isArray(list) ? list[k % list.length] : list);

const SETS = {
  female: {
    dir: 'assets/sprites/female/',
    aspect: '630 / 776',
    // appearance.js hair colours -> the sprite's tones.
    tone: {
      '#2b1d14': 'dark', '#1b1b1b': 'dark', '#4a2f1d': 'brown', '#7a4a24': 'brown', '#8a3b1f': 'brown',
      '#b07a3a': 'blond', '#d8b56a': 'blond', '#c9c9c2': 'silver', '#d8d8e0': 'silver', '#e89aa8': 'pink',
    },
    // appearance.js hair styles -> [back, front] choices.
    style: {
      long: [['long', 'long'], ['long', 'hime'], ['long', 'long']], bun: [['bob', 'bob']], braid: [['twin', 'twin']],
      short: [['short', 'twin']],
    },
    face: {
      joyful: ['laugh', 'delighted'], happy: ['smile', 'smile_2'], content: ['normal', 'smug'], sad: ['sad'],
      miserable: ['sad', 'annoyed'], angry: ['angry', 'annoyed'], grieving: ['sad'], lonely: ['sad', 'normal'], starving: ['shocked', 'sad'],
    },
    sleepFace: 'sleepy',
    // Outfits by rank, from the Outcast up; then the special cases.
    rank: ['hoodie_1', 'hoodie_1', 'summer_dress', 'seifuku_1', 'seifuku_2', 'seifuku_2'],
    royal: 'seifuku_2', winter: 'winter_outfit', train: 'pe_uniform', sleep: 'pajama',
    glasses: { research: 'circle_glasses', clever: 'black_glasses', curious: 'red_glasses' },
    blush: true, flower: true, choker: true,
  },
  male: {
    dir: 'assets/sprites/male/',
    aspect: '630 / 853',
    tone: {
      '#2b1d14': 'dark', '#1b1b1b': 'dark', '#4a2f1d': 'brown', '#7a4a24': 'brown', '#8a3b1f': 'red',
      '#b07a3a': 'blond', '#d8b56a': 'blond', '#c9c9c2': 'silver',
    },
    style: {
      short: [['short_1', 'short_1'], ['short_1', 'short_2'], ['short_2', 'style_3_short']],
      spiky: [['short_2', 'short_1'], ['short_2', 'style_4_short']],
      long: [['long_hair', 'style_3'], ['long_hair', 'style_4']],
      shaggy: [['short_3', 'curly'], ['short_3', 'side']],
      bald: [['short_3', 'style_3_short']],
    },
    face: {
      joyful: ['laugh', 'smile_3'], happy: ['smile_1', 'smile_2'], content: ['normal', 'smirk'], sad: ['sad'],
      miserable: ['sad', 'angry_1'], angry: ['angry_1', 'angry_2'], grieving: ['sad'], lonely: ['sad', 'normal'], starving: ['surprised', 'sad'],
    },
    sleepFace: 'smile_2',
    rank: [['casual_2_2'], ['casual_2_1', 'casual_3_1', 'casual_3_3'], ['casual_1_1', 'casual_1_2'], ['vest'], ['school_uniform_3'], ['school_uniform_1']],
    royal: 'school_uniform_1', winter: 'winter', train: 'p_e_uniform', sleep: 'casual_2_1',
    glasses: { research: 'circle_glasses', clever: 'black_glasses' },
    sweat: true,
  },
};

const WORK = new Set(['build', 'gather', 'harvest', 'craft', 'train']);

export const hasSprite = (who, stage) => stage !== 'child' && !!SETS[who.sex];

// Which layers make up this person right now. `mood` is from royalMarks:
// { id, emotion, rank, royal, action, season, traits, research, looks }.
export function spriteLayers(sex, look, mood = {}) {
  const S = SETS[sex];
  const k = mood.id ?? 0;
  const [back, front] = pick(S.style[look.hairStyle] ?? S.style[Object.keys(S.style)[0]], k);
  const tone = S.tone[look.hair] ?? 'brown';
  let outfit = pick(S.rank[Math.max(0, mood.rank ?? 1)] ?? S.rank[1], k);
  if (mood.royal) outfit = S.royal;
  if (mood.season === 'Winter') outfit = S.winter;
  if (mood.action === 'train') outfit = S.train;
  if (mood.action === 'sleep') outfit = S.sleep;
  const face = mood.action === 'sleep' ? S.sleepFace : pick(S.face[mood.emotion] ?? S.face.content, k);
  const layers = [`back_${back}_${tone}`, 'body'];
  if (S.blush && ((mood.looks ?? 5) >= 7 || mood.emotion === 'joyful')) layers.push(mood.emotion === 'joyful' ? 'blush2' : 'blush1');
  layers.push(`outfit_${outfit}`, `front_${front}_${tone}`, `face_${face}`);
  if (S.sweat && WORK.has(mood.action)) layers.push('face_sweat');
  const traits = mood.traits ?? [];
  const g = S.glasses;
  if ((mood.research ?? 0) >= 5 && g.research) layers.push(`acc_${g.research}`);
  else if (traits.includes('clever') && g.clever) layers.push(`acc_${g.clever}`);
  else if (traits.includes('curious') && k % 2 && g.curious) layers.push(`acc_${g.curious}`);
  if (S.flower && (mood.looks ?? 5) >= 8) layers.push('acc_flower');
  if (S.choker && ((mood.rank ?? 0) >= 4 || mood.royal)) layers.push('acc_choker');
  return layers;
}

// The stacked images. `crop` 'face' fills a square portrait with the head;
// 'bust' shows the whole sprite.
export function spriteNode(sex, layers, crop = 'face') {
  const S = SETS[sex];
  const box = el('div', `sprite ${crop} ${sex}`);
  box.style.aspectRatio = S.aspect;
  for (const name of layers) {
    const img = document.createElement('img');
    img.src = `${S.dir}${name}.webp`;
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    box.append(img);
  }
  return box;
}
