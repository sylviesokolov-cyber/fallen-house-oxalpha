import { el } from './dom.js';

// Anime portraits for grown women, assembled from the layered sprite by
// Sutemo (assets/sprites/female): back hair, body, blush, outfit, front hair,
// expression and accessories, stacked in that order. Every layer is the same
// size and lines up, so a portrait is just a pile of images. What's chosen
// comes from who she is: her hair (from appearance.js), her rank, mood,
// what she's doing, the season and her traits.

const DIR = 'assets/sprites/female/';

// appearance.js hair colours -> the sprite's five tones.
const TONE = {
  '#2b1d14': 'dark', '#1b1b1b': 'dark', '#4a2f1d': 'brown', '#7a4a24': 'brown', '#8a3b1f': 'brown',
  '#b07a3a': 'blond', '#d8b56a': 'blond', '#c9c9c2': 'silver', '#d8d8e0': 'silver', '#e89aa8': 'pink',
};
// appearance.js hair styles -> [back, front].
const STYLE = { long: ['long', 'long'], hime: ['long', 'hime'], bun: ['bob', 'bob'], braid: ['twin', 'twin'], short: ['short', 'twin'] };
// Emotions -> expressions (two to pick from, so not everyone looks alike).
const FACE = {
  joyful: ['laugh', 'delighted'], happy: ['smile', 'smile_2'], content: ['normal', 'smug'], sad: ['sad', 'sad'],
  miserable: ['sad', 'annoyed'], angry: ['angry', 'annoyed'], grieving: ['sad', 'sad'], lonely: ['sad', 'normal'], starving: ['shocked', 'sad'],
};
// Outfits by rank, from the Outcast up.
const RANK_OUTFIT = ['hoodie_1', 'hoodie_1', 'summer_dress', 'seifuku_1', 'seifuku_2', 'seifuku_2'];

// Which layers make up this woman right now. `mood` is from portraitMarks:
// { emotion, rank, royal, action, season, traits, research, looks, id }.
export function spriteLayers(look, mood = {}) {
  const k = mood.id ?? 0;
  const style = look.hairStyle === 'long' && k % 3 === 0 ? 'hime' : look.hairStyle;
  const [back, front] = STYLE[style] ?? STYLE.long;
  const tone = TONE[look.hair] ?? 'brown';
  let outfit = RANK_OUTFIT[Math.max(0, mood.rank ?? 1)] ?? 'summer_dress';
  if (mood.royal) outfit = 'seifuku_2';
  if (mood.season === 'Winter') outfit = 'winter_outfit';
  if (mood.action === 'train') outfit = 'pe_uniform';
  if (mood.action === 'sleep') outfit = 'pajama';
  const faces = FACE[mood.emotion] ?? FACE.content;
  let face = faces[k % 2];
  if (mood.action === 'sleep') face = 'sleepy';
  const layers = [`back_${back}_${tone}`, 'body'];
  if ((mood.looks ?? 5) >= 7 || mood.emotion === 'joyful') layers.push(mood.emotion === 'joyful' ? 'blush2' : 'blush1');
  layers.push(`outfit_${outfit}`, `front_${front}_${tone}`, `face_${face}`);
  const traits = mood.traits ?? [];
  if ((mood.research ?? 0) >= 5) layers.push('acc_circle_glasses');
  else if (traits.includes('clever')) layers.push('acc_black_glasses');
  else if (traits.includes('curious') && k % 2) layers.push('acc_red_glasses');
  if ((mood.looks ?? 5) >= 8) layers.push('acc_flower');
  if ((mood.rank ?? 0) >= 4 || mood.royal) layers.push('acc_choker');
  return layers;
}

// The stacked images. `crop` 'face' fills a square portrait with her head;
// 'bust' shows the whole sprite.
export function spriteNode(layers, crop = 'face') {
  const box = el('div', `sprite ${crop}`);
  for (const name of layers) {
    const img = document.createElement('img');
    img.src = `${DIR}${name}.webp`;
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    box.append(img);
  }
  return box;
}
