// The game's icon set: small hand-built SVGs sharing one palette and a dark
// outline, so every screen has the same look on any phone (platform emoji
// vary a lot). icon('wood') returns an <svg> element; iconHtml for markup.

const O = '#17202e'; // outline
const S = `stroke="${O}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"`;

const ICONS = {
  wood: `<rect x="3" y="9" width="17" height="7" rx="3.5" fill="#a0703a" ${S}/><ellipse cx="19" cy="12.5" rx="2.6" ry="3.5" fill="#e8c28a" ${S}/><ellipse cx="19" cy="12.5" rx="1" ry="1.4" fill="#a0703a"/><path d="M7 11h6M8 14h5" stroke="#6b4a2b" stroke-width="1.2" stroke-linecap="round"/>`,
  potato: `<path d="M5 13c0-4 3-7 7.5-7S20 8.5 20 12s-3 7-7.5 7S5 17 5 13z" fill="#d2a45a" ${S}/><circle cx="10" cy="11" r="0.9" fill="#8a6230"/><circle cx="14" cy="14.5" r="0.9" fill="#8a6230"/><circle cx="16" cy="10.5" r="0.8" fill="#8a6230"/><path d="M11 6.5c0-2 1.5-3 3-3" stroke="#4f8a2a" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  meal: `<path d="M3 12h18c0 4.5-4 7.5-9 7.5S3 16.5 3 12z" fill="#d9822b" ${S}/><path d="M5 12c1-2 3-3 7-3s6 1 7 3" fill="#f5c04a" ${S}/><path d="M9 7c0-1 1-1 1-2M13 7c0-1 1-1 1-2" stroke="#9aa8bb" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,
  ale: `<rect x="5" y="8" width="11" height="12" rx="2" fill="#e8a33a" ${S}/><path d="M16 11h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2" fill="none" ${S}/><path d="M4.5 8.5c0-2 1.5-3 3-3 .5-1.5 2-2 3-1.5 1-1 3-1 4 .5 1.5 0 2 1.5 2 2.5z" fill="#fff6e0" ${S}/>`,
  meat: `<path d="M6 16c-2-3 0-9 5-10s9 2 8 6-6 7-9 6z" fill="#d9534f" ${S}/><path d="M9 11c1-2 4-3 6-2" stroke="#f3b0a0" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M8 17l-3 3" stroke="#f5f0e6" stroke-width="3" stroke-linecap="round"/><circle cx="4.5" cy="20.5" r="1.6" fill="#f5f0e6" ${S}/>`,
  ore: `<path d="M4 17l3-7 5-2 6 2 2 6-4 4H8z" fill="#6d7a8c" ${S}/><path d="M9 12l2 2M14 11l1 3" stroke="#c9d2de" stroke-width="1.4" stroke-linecap="round"/><circle cx="12.5" cy="16" r="1.2" fill="#e8792a"/>`,
  crystal: `<path d="M12 2l5 6-5 14-5-14z" fill="#b99cff" ${S}/><path d="M12 2v20M7 8h10" stroke="#6d4bd1" stroke-width="1" fill="none"/><path d="M9.5 7l2.5-3" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>`,
  herb: `<path d="M12 21V9" stroke="#3f7a2a" stroke-width="1.8" stroke-linecap="round"/><path d="M12 13c-5 0-7-3-7-6 4 0 7 2 7 6zM12 11c4 0 7-2.5 7-6-4 0-7 2-7 6z" fill="#6cc56b" ${S}/>`,
  remedy: `<path d="M9 3h6v4l3 4v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8l3-4z" fill="#dff5e6" ${S}/><path d="M6.5 13h11v6a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z" fill="#6cc56b"/><path d="M12 14v5M9.5 16.5h5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>`,
  faith: `<path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" fill="#ffd35c" ${S}/><circle cx="12" cy="11" r="2" fill="#fff6c4"/>`,
  people: `<circle cx="8.5" cy="8" r="3" fill="#f3d2b3" ${S}/><path d="M3 20c0-4 2.5-7 5.5-7s5.5 3 5.5 7z" fill="#6fb3ff" ${S}/><circle cx="16" cy="9" r="2.6" fill="#e8b98f" ${S}/><path d="M12.5 20c.3-3.3 1.6-6 3.5-6 2.5 0 4.5 2.7 4.5 6z" fill="#e98fb3" ${S}/>`,
  pause: `<rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor"/>`,
  play: `<path d="M7 5l12 7-12 7z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>`,
  fast: `<path d="M3 6l9 6-9 6zM12 6l9 6-9 6z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>`,
  restart: `<path d="M5 12a7 7 0 1 0 2.2-5.1" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M4 3.5v5h5z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>`,
  faster: `<path d="M1.5 7l7 5-7 5zM8.5 7l7 5-7 5zM15.5 7l7 5-7 5z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>`,
  log: `<path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z" fill="#e8d9b0" ${S}/><path d="M6 3a2 2 0 0 0-2 2v1h2M6 21a2 2 0 0 1-2-2v-1h2" fill="#c9b27a" ${S}/><path d="M9 8h7M9 11.5h7M9 15h5" stroke="#8a6a45" stroke-width="1.4" stroke-linecap="round"/>`,
  tribe: `<path d="M5 3v18" stroke="#8a6a45" stroke-width="2" stroke-linecap="round"/><path d="M6 4h13l-3 4.5 3 4.5H6z" fill="#e5604f" ${S}/><path d="M11 6.5l1 2 2 .3-1.5 1.3.4 2L11 11l-1.9 1.1.4-2L8 8.8l2-.3z" fill="#ffd35c"/>`,
  menu: `<path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`,
  close: `<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`,
  bless: `<circle cx="12" cy="12" r="5" fill="#ffd35c" ${S}/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke="#ffd35c" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="2" fill="#fff6c4"/>`,
  inspire: `<path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z" fill="#fff0a8" ${S}/><rect x="9" y="17" width="6" height="3" rx="1" fill="#9aa8bb" ${S}/><path d="M12 7v4M10.5 9h3" stroke="#e8a33a" stroke-width="1.4" stroke-linecap="round"/>`,
  omen: `<path d="M21 3L7.5 12.5 3 21l8.5-4.5z" fill="#ffb454" opacity=".35"/><path d="M19.5 4.5L9 12l-3 6 6-3z" fill="#ffd35c" opacity=".75"/><circle cx="15.5" cy="8.5" r="5" fill="#fff0a8" ${S}/><circle cx="14" cy="7" r="1.8" fill="#fff"/>`,
  portal: `<ellipse cx="12" cy="12" rx="8" ry="9.5" fill="#2a1a55" ${S}/><path d="M12 5.5c3 0 5 2.5 5 5.5s-2.5 5-5 5-4-2-4-4 1.5-3 3-3 2.5 1 2.5 2.5" fill="none" stroke="#b99cff" stroke-width="1.8" stroke-linecap="round"/>`,
  sword: `<path d="M18 3h3v3L10 17l-3-3z" fill="#dfe6ee" ${S}/><path d="M5 12l7 7" stroke="${O}" stroke-width="1.4"/><path d="M5.5 12.5l6 6" stroke="#ffd35c" stroke-width="2.6" stroke-linecap="round"/><path d="M7 17l-3.5 3.5" stroke="#8a5a2b" stroke-width="2.6" stroke-linecap="round"/>`,
  bow: `<path d="M6 3c8 3 11 9 8 18" fill="none" stroke="#a0703a" stroke-width="2.4" stroke-linecap="round"/><path d="M6.5 3.5L14 20.5" stroke="#e8e2d0" stroke-width="1"/><path d="M4 14l12-6" stroke="#dfe6ee" stroke-width="1.6" stroke-linecap="round"/><path d="M16 8l-3-.5 1.5 2.5z" fill="#dfe6ee" ${S}/>`,
  magic: `<path d="M6 21L15 9" stroke="#8a5a2b" stroke-width="2.4" stroke-linecap="round"/><circle cx="16.5" cy="7.5" r="3.5" fill="#b99cff" ${S}/><path d="M20 2l.7 1.8L22.5 4.5l-1.8.7L20 7l-.7-1.8-1.8-.7 1.8-.7z" fill="#ffd35c"/>`,
  shield: `<path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" fill="#6d7a8c" ${S}/><path d="M12 5.5l5.5 2v4c0 3.5-2.3 6-5.5 7.3z" fill="#9fb0c4"/>`,
  heart: `<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z" fill="#e5604f" ${S}/><path d="M8 8a2 2 0 0 1 2-1.5" stroke="#ffb3a8" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
  crown: `<path d="M3 18l1.5-10 4.5 4 3-6 3 6 4.5-4L21 18z" fill="#ffd35c" ${S}/><rect x="3" y="18" width="18" height="3" rx="1" fill="#e8a33a" ${S}/>`,
  star: `<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="#ffd35c" ${S}/>`,
  book: `<path d="M3 5c3-1.5 6-1.5 9 0v15c-3-1.5-6-1.5-9 0z" fill="#6fb3ff" ${S}/><path d="M21 5c-3-1.5-6-1.5-9 0v15c3-1.5 6-1.5 9 0z" fill="#3b82b6" ${S}/>`,
  hammer: `<path d="M13 6l5 5-9.5 9.5a2 2 0 0 1-2.8 0l-2.2-2.2a2 2 0 0 1 0-2.8z" fill="#a0703a" ${S}/><path d="M10 4l4-2 7 7-2 4z" fill="#9fb0c4" ${S}/>`,
  save: `<path d="M4 6a2 2 0 0 1 2-2h10l4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="#a0703a" ${S}/><rect x="7" y="4" width="9" height="5" fill="#e8d9b0" ${S}/><circle cx="12" cy="15" r="2.5" fill="#ffd35c" ${S}/>`,
  sound: `<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  music: `<path d="M9 18V6l11-2v12" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.5" fill="currentColor"/><circle cx="17.5" cy="16" r="2.5" fill="currentColor"/>`,
  spring: `<path d="M12 21v-8" stroke="#3f7a2a" stroke-width="2" stroke-linecap="round"/><path d="M12 14c-5 0-7-4-7-7 4 0 7 3 7 7zM12 12c3.5 0 6.5-2 6.5-6-4 0-6.5 2.5-6.5 6z" fill="#8fd16a" ${S}/>`,
  summer: `<circle cx="12" cy="12" r="4.5" fill="#ffd35c" ${S}/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" stroke="#ffb454" stroke-width="2" stroke-linecap="round"/>`,
  autumn: `<path d="M12 3l2 4 4-1-1 4 4 2-4 2 1 4-4-1-2 4-2-4-4 1 1-4-4-2 4-2-1-4 4 1z" fill="#e8792a" ${S}/><path d="M12 12v9" stroke="#8a5a2b" stroke-width="1.6" stroke-linecap="round"/>`,
  winter: `<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" stroke="#bfe0ff" stroke-width="2" stroke-linecap="round"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5" stroke="#bfe0ff" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  baby: `<circle cx="12" cy="10" r="6" fill="#f3d2b3" ${S}/><circle cx="10" cy="10" r=".9" fill="${O}"/><circle cx="14" cy="10" r=".9" fill="${O}"/><path d="M10.5 13c1 .8 2 .8 3 0" stroke="${O}" stroke-width="1" fill="none" stroke-linecap="round"/><path d="M6 20c1-2.5 3.5-3.5 6-3.5s5 1 6 3.5" fill="#bfe0ff" ${S}/>`,
  candle: `<rect x="8.5" y="11" width="7" height="10" rx="1" fill="#f5f0e6" ${S}/><path d="M12 11V8.5" stroke="${O}" stroke-width="1.2"/><path d="M12 2.5c2 2.5 2.5 4 0 6-2.5-2-2-3.5 0-6z" fill="#ffb454" ${S}/>`,
  bulb: `<path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z" fill="#ffd35c" ${S}/><rect x="9" y="17" width="6" height="3" rx="1" fill="#9aa8bb" ${S}/>`,
  house: `<path d="M3 11l9-7 9 7" fill="none" ${S}/><path d="M5 10v10h14V10l-7-5.5z" fill="#e8c28a" ${S}/><path d="M3 11l9-7 9 7-1.5 1.5L12 6.5l-7.5 6z" fill="#c0543a" ${S}/><rect x="10" y="14" width="4" height="6" fill="#8a5a2b" ${S}/>`,
  swords: `<path d="M4 4l10 10M20 4L10 14" stroke="#dfe6ee" stroke-width="2.6" stroke-linecap="round"/><path d="M4 4l10 10M20 4L10 14" stroke="${O}" stroke-width="0.8" stroke-linecap="round" opacity=".5"/><path d="M11 17l-4 4M13 17l4 4" stroke="#8a5a2b" stroke-width="2.6" stroke-linecap="round"/><path d="M9 14l3 3M15 14l-3 3" stroke="#ffd35c" stroke-width="2.4" stroke-linecap="round"/>`,
  help: `<circle cx="12" cy="12" r="9" fill="#3b82b6" ${S}/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 1-1 1.7" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="12" cy="17" r="1.2" fill="#fff"/>`,
  moon: `<path d="M15 3a9 9 0 1 0 6 12.5A7 7 0 0 1 15 3z" fill="#e4eeff" ${S}/><circle cx="10" cy="14" r="1.2" fill="#b8c6e0"/><circle cx="13" cy="18" r=".8" fill="#b8c6e0"/>`,
  infinity: `<path d="M12 12c-2-3-4-4.5-6-4.5a4.5 4.5 0 0 0 0 9c2 0 4-1.5 6-4.5zm0 0c2 3 4 4.5 6 4.5a4.5 4.5 0 0 0 0-9c-2 0-4 1.5-6 4.5z" fill="none" stroke="#b99cff" stroke-width="2.6" stroke-linecap="round"/><path d="M12 12c-2-3-4-4.5-6-4.5a4.5 4.5 0 0 0 0 9c2 0 4-1.5 6-4.5z" fill="none" stroke="#fff0a8" stroke-width="1" opacity=".7"/>`,
  sparkle: `<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="#ffd35c" ${S}/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" fill="#fff0a8"/>`,
};

export const ICON_NAMES = Object.keys(ICONS);

export function iconHtml(name, cls = '') {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ICONS.star}</svg>`;
}

// A standalone SVG as a data URL, for loading an icon as a Phaser texture.
export function iconDataUrl(name, size = 48) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">${ICONS[name] ?? ICONS.star}</svg>`;
  // Phaser's loader decodes data URLs as base64. The SVGs are plain ASCII.
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function icon(name, cls = '') {
  const t = document.createElement('template');
  t.innerHTML = iconHtml(name, cls);
  return t.content.firstChild;
}

// Fills every <i data-icon="name"> placeholder in the static page.
export function hydrateIcons(root = document) {
  for (const i of root.querySelectorAll('i[data-icon]')) i.replaceWith(icon(i.dataset.icon, i.className));
}
