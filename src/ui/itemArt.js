// Little coloured pictures for items, techs and buildings, drawn as SVG.
// Each data entry names one with `art`: a glyph, optionally with a colour
// ("bowl:#d9a441"). Unknown or missing art falls back to a plain gem.

const O = 'stroke="#1b1420" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"';

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(Math.min(255, f < 1 ? v * f : v + (255 - v) * (f - 1))));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const steam = '<path d="M12 7c-1-2 1-3 0-5M16 7c-1-2 1-3 0-5M20 7c-1-2 1-3 0-5" stroke="#e8eef8" stroke-width="1.2" fill="none" opacity=".7" stroke-linecap="round"/>';
const bowlBase = `<path d="M5 15h22c0 7-5 11-11 11S5 22 5 15z" fill="#c98a4a" ${O}/><path d="M8 18c2 4 5 6 8 6" stroke="#e8b27a" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;

const GLYPHS = {
  bowl: (c) => `${steam}<ellipse cx="16" cy="15" rx="11" ry="3.5" fill="${c}" ${O}/>${bowlBase}<circle cx="12" cy="14.5" r="1.3" fill="${shade(c, 1.4)}"/><circle cx="19" cy="15" r="1.1" fill="${shade(c, 0.7)}"/>`,
  mash: (c) => `${steam}<path d="M7 15c1-5 5-7 9-7s8 2 9 7z" fill="${c}" ${O}/><path d="M14 10l2-1 2 1" stroke="#fff4b0" stroke-width="1.5" fill="none"/>${bowlBase}`,
  bread: (c) => `<path d="M4 20c0-7 5-11 12-11s12 4 12 11c0 3-2 4-4 4H8c-2 0-4-1-4-4z" fill="${c}" ${O}/><path d="M11 12l2 5M16 11l1 6M21 12l-1 5" stroke="${shade(c, 0.65)}" stroke-width="1.6" stroke-linecap="round"/><path d="M8 13c2-2 4-3 6-3" stroke="${shade(c, 1.35)}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
  roast: (c) => `<path d="M17 5c6 0 10 4 10 9s-5 8-9 8c-2 0-3-1-4-2l-5 5c-1 1-3 1-4 0s-1-3 0-4l5-5c-1-1-2-2-2-4 0-4 4-7 9-7z" fill="${c}" ${O}/><circle cx="6" cy="25" r="2.2" fill="#f4ecd8" ${O}/><path d="M16 9c3 0 6 2 7 5" stroke="${shade(c, 1.4)}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  skewer: (c) => `<path d="M4 28L28 4" stroke="#a07440" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="22" r="4" fill="${c}" ${O}/><rect x="13.5" y="13.5" width="7" height="6" rx="2" transform="rotate(-45 17 16.5)" fill="#9a4a3a" ${O}/><circle cx="23" cy="9" r="3.6" fill="${c}" ${O}/>`,
  pie: (c) => `<path d="M4 18l12-9 12 9z" fill="${c}" ${O}/><path d="M4 18h24v4c0 2-1 3-3 3H7c-2 0-3-1-3-3z" fill="${shade(c, 0.75)}" ${O}/><path d="M10 15l3 1M17 13l2 2M21 16l2 0" stroke="${shade(c, 0.6)}" stroke-width="1.4" stroke-linecap="round"/>`,
  mug: (c) => `<rect x="6" y="9" width="15" height="18" rx="3" fill="${c}" ${O}/><path d="M21 13h3c2 0 3 1 3 3v3c0 2-1 3-3 3h-3" fill="none" ${O} stroke-width="2"/><path d="M5 10c0-3 2-5 5-5 1-2 5-2 6 0 3 0 6 1 6 4 0 2-1 3-2 3H7c-1 0-2-1-2-2z" fill="#fff8e8" ${O}/><path d="M10 15v8M15 15v8" stroke="${shade(c, 1.3)}" stroke-width="1.6" stroke-linecap="round"/>`,
  sword: (c) => `<path d="M24 3l5 1-1 5-14 14-4-4z" fill="${c}" ${O}/><path d="M25 5L13 17" stroke="${shade(c, 1.4)}" stroke-width="1.2"/><path d="M7 17l8 8" stroke="#8a5a2b" stroke-width="3.2" stroke-linecap="round"/><path d="M8 24l-4 4" stroke="#5a3a1b" stroke-width="3" stroke-linecap="round"/><circle cx="3.8" cy="28.2" r="1.8" fill="#f2c14e" ${O}/>`,
  bow: () => `<path d="M8 3c12 3 18 10 21 21" fill="none" stroke="#8a5a2b" stroke-width="3" stroke-linecap="round"/><path d="M8 3L29 24" stroke="#eee" stroke-width="1"/><path d="M5 27l17-17" stroke="#c9ccd6" stroke-width="1.5"/><path d="M22 10l-4 0 4-4z" fill="#c9ccd6" ${O}/><path d="M5 27l3-1-2-2z" fill="#d94a4a"/>`,
  axe: (c) => `<path d="M9 28L22 8" stroke="#8a5a2b" stroke-width="3" stroke-linecap="round"/><path d="M17 5c5-2 10 1 11 6-3-1-6 0-8 3l-5-3c1-2 1-4 2-6z" fill="${c}" ${O}/>`,
  hoe: () => `<path d="M6 28L22 7" stroke="#8a5a2b" stroke-width="3" stroke-linecap="round"/><path d="M19 4l8 6-3 3-7-5z" fill="#8b8f99" ${O}/>`,
  basket: () => `<path d="M9 14c0-6 3-9 7-9s7 3 7 9" fill="none" stroke="#a07440" stroke-width="2.2"/><path d="M4 14h24l-3 12c0 1-1 2-2 2H9c-1 0-2-1-2-2z" fill="#c9954a" ${O}/><path d="M6 18h20M7 22h18M12 14l1 14M20 14l-1 14" stroke="#8a5a2b" stroke-width="1.1"/>`,
  armor: (c) => `<path d="M10 4l6 3 6-3 6 4-2 7-2-1v13c-3 2-5 2-8 2s-5 0-8-2V14l-2 1-2-7z" fill="${c}" ${O}/><path d="M16 8v20" stroke="${shade(c, 0.7)}" stroke-width="1.2"/><path d="M11 14c3 2 7 2 10 0" stroke="${shade(c, 1.35)}" stroke-width="1.5" fill="none"/>`,
  staff: () => `<path d="M8 29L21 11" stroke="#7a5230" stroke-width="3" stroke-linecap="round"/><path d="M24 2l4 5-3 6-6-2-1-5z" fill="#b48cff" ${O}/><path d="M23 5l2 3" stroke="#f0e4ff" stroke-width="1.3"/>`,
  bottle: (c) => `<rect x="13" y="3" width="6" height="5" rx="1" fill="#a07440" ${O}/><path d="M12 8h8v3c4 2 6 5 6 9 0 5-4 8-10 8S6 25 6 20c0-4 2-7 6-9z" fill="${c}" ${O}/><path d="M9 19c0-3 2-5 4-6" stroke="#fff" stroke-width="1.5" fill="none" opacity=".6" stroke-linecap="round"/><path d="M14 19h4M16 17v4" stroke="#fff" stroke-width="1.8"/>`,
  meat: (c) => `<path d="M6 12c2-6 10-8 16-5s7 11 2 15-15 5-18-2c-1-3-1-5 0-8z" fill="${c}" ${O}/><path d="M9 13c3-4 9-4 12-1" stroke="#ffd0c8" stroke-width="1.6" fill="none"/><circle cx="19" cy="18" r="2.5" fill="#f4ecd8" ${O}/>`,
  mushroom: (c) => `<path d="M12 18h8l1 9c0 1-1 2-2 2h-6c-1 0-2-1-2-2z" fill="#f1e6cc" ${O}/><path d="M4 18c0-8 5-13 12-13s12 5 12 13z" fill="${c}" ${O}/><circle cx="11" cy="12" r="2" fill="#fff" opacity=".8"/><circle cx="19" cy="10" r="1.5" fill="#fff" opacity=".8"/><circle cx="22" cy="15" r="1.3" fill="#fff" opacity=".8"/>`,
  herbs: (c) => `<path d="M16 29V12" stroke="#4a7a3a" stroke-width="2"/><path d="M16 14C10 14 6 10 6 4c6 0 10 4 10 10zM16 18c6 0 10-4 10-10-6 0-10 4-10 10zM16 24c-5 0-8-3-9-7 5 0 8 3 9 7z" fill="${c}" ${O}/>`,
  hide: (c) => `<path d="M8 4l4 3h8l4-3 2 6-2 4 3 6-3 3 1 5-5-2-4 2-4-2-5 2 1-5-3-3 3-6-2-4z" fill="${c}" ${O}/><path d="M12 12c2 1 6 1 8 0M11 18c3 1 7 1 10 0" stroke="${shade(c, 0.7)}" stroke-width="1.2" fill="none"/>`,
  bone: () => `<path d="M9 23l14-14" stroke="#f1ead6" stroke-width="5" stroke-linecap="round"/><circle cx="7" cy="22" r="3" fill="#f1ead6" ${O}/><circle cx="10" cy="25" r="3" fill="#f1ead6" ${O}/><circle cx="22" cy="7" r="3" fill="#f1ead6" ${O}/><circle cx="25" cy="10" r="3" fill="#f1ead6" ${O}/><path d="M9 23l14-14" stroke="#f1ead6" stroke-width="4" stroke-linecap="round"/>`,
  ore: (c) => `<path d="M4 22l4-10 8-4 9 3 3 9-5 7H9z" fill="#6d7a8c" ${O}/><path d="M8 12l6 4 2 8M16 8l0 8 9-5" stroke="#4d5866" stroke-width="1.1" fill="none"/><circle cx="11" cy="19" r="1.8" fill="${c}"/><circle cx="21" cy="17" r="1.5" fill="${c}"/><circle cx="18" cy="24" r="1.2" fill="${c}"/>`,
  crystal: (c) => `<path d="M16 2l7 9-7 19-7-19z" fill="${c}" ${O}/><path d="M9 11h14M16 2v28" stroke="${shade(c, 1.4)}" stroke-width="1"/><path d="M6 16l4-3 3 6-3 8z" fill="${shade(c, 0.8)}" ${O}/><path d="M26 16l-4-3-3 6 3 8z" fill="${shade(c, 0.8)}" ${O}/>`,
  ingot: (c) => `<path d="M4 22l5-9h14l5 9z" fill="${c}" ${O}/><path d="M9 13h14l-2 4H11z" fill="${shade(c, 1.35)}"/><path d="M4 22h24v3H4z" fill="${shade(c, 0.7)}" ${O}/><path d="M24 6l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="#fff"/>`,
  potato: () => `<path d="M6 17c0-7 6-11 12-10s9 5 8 11-6 9-12 8-8-4-8-9z" fill="#c9a35a" ${O}/><circle cx="12" cy="15" r="1" fill="#8a6a2a"/><circle cx="19" cy="12" r="1" fill="#8a6a2a"/><circle cx="20" cy="20" r="1" fill="#8a6a2a"/>`,
  log: () => `<rect x="4" y="11" width="22" height="11" rx="5.5" fill="#8a5a2b" ${O}/><ellipse cx="25" cy="16.5" rx="4" ry="5.5" fill="#d9aa6a" ${O}/><ellipse cx="25" cy="16.5" rx="1.8" ry="2.6" fill="none" stroke="#a07440" stroke-width="1"/><path d="M8 14h10M9 19h9" stroke="#6b4420" stroke-width="1.1"/>`,
  sprout: () => `<path d="M4 26h24" stroke="#8a5a2b" stroke-width="3" stroke-linecap="round"/><path d="M16 25V13" stroke="#4a8a3a" stroke-width="2"/><path d="M16 15c-6 0-9-4-9-9 6 0 9 4 9 9zM16 13c0-5 3-8 9-8 0 6-3 8-9 8z" fill="#7fc45a" ${O}/>`,
  hammer: () => `<path d="M17 14L6 27" stroke="#8a5a2b" stroke-width="3.2" stroke-linecap="round"/><path d="M13 5l5-2 10 10-3 4-5-2-3 2-4-4 2-3z" fill="#8b8f99" ${O}/>`,
  saw: () => `<path d="M4 20L22 6l6 6-18 14z" fill="#c9ccd6" ${O}/><path d="M6 22l2 2 2-3 2 2 2-3 2 2 2-3 2 2" stroke="#6d7a8c" stroke-width="1" fill="none"/><rect x="21" y="3" width="7" height="6" rx="2" transform="rotate(45 24.5 6)" fill="#8a5a2b" ${O}/>`,
  jar: (c) => `<rect x="9" y="4" width="14" height="4" rx="1.5" fill="#8a5a2b" ${O}/><path d="M8 9h16c2 3 2 6 2 9 0 6-4 10-10 10S6 24 6 18c0-3 0-6 2-9z" fill="${c}" ${O}/><rect x="11" y="14" width="10" height="7" rx="1" fill="#f4ecd8" ${O}/>`,
  scroll: () => `<path d="M8 6h16v20H8z" fill="#f4ecd8" ${O}/><rect x="5" y="3" width="22" height="5" rx="2.5" fill="#d9c09a" ${O}/><rect x="5" y="24" width="22" height="5" rx="2.5" fill="#d9c09a" ${O}/><path d="M11 12h10M11 16h10M11 20h7" stroke="#8a7a5a" stroke-width="1.3"/>`,
  dummy: () => `<path d="M16 12v16M9 28h14" stroke="#6b4a2b" stroke-width="2.4" stroke-linecap="round"/><path d="M8 13h16" stroke="#6b4a2b" stroke-width="2.4" stroke-linecap="round"/><circle cx="16" cy="8" r="4.5" fill="#d9b67a" ${O}/><path d="M11 13h10v9H11z" fill="#c9954a" ${O}/><path d="M13 16l6 3M19 16l-6 3" stroke="#b33" stroke-width="1.5"/>`,
  columns: () => `<path d="M3 11L16 4l13 7z" fill="#e8e2d0" ${O}/><path d="M6 12h3v12H6zM14.5 12h3v12h-3zM23 12h3v12h-3z" fill="#f4efe0" ${O}/><rect x="3" y="24" width="26" height="4" fill="#cfc6ae" ${O}/>`,
  anvil: () => `<path d="M4 10h20c0 3 2 4 5 4-1 2-4 3-8 3h-2v4h4v4H9v-4h4v-4c-5 0-9-3-9-7z" fill="#50535c" ${O}/><path d="M6 11h17" stroke="#8b8f99" stroke-width="1.3"/><path d="M22 4l2 3M27 5l-2 3M19 6l3 2" stroke="#ffb14a" stroke-width="1.4" stroke-linecap="round"/>`,
  book: (c) => `<path d="M5 6c4-1 8 0 11 2v20c-3-2-7-3-11-2z" fill="#f4ecd8" ${O}/><path d="M27 6c-4-1-8 0-11 2v20c3-2 7-3 11-2z" fill="#f4ecd8" ${O}/><path d="M4 7v20c4-1 8 0 12 2 4-2 8-3 12-2V7" fill="none" stroke="${c}" stroke-width="2.4"/><path d="M8 12h5M8 16h5M19 12h5M19 16h5" stroke="#9a8a6a" stroke-width="1"/>`,
  tower: () => `<path d="M10 12h12l-1 16H11z" fill="#6d6a8a" ${O}/><path d="M8 13L16 2l8 11z" fill="#6d4bd1" ${O}/><rect x="14" y="17" width="4" height="5" rx="2" fill="#ffe36a"/><circle cx="16" cy="3" r="1.5" fill="#ffe36a"/>`,
  cross: () => `<rect x="4" y="4" width="24" height="24" rx="6" fill="#f4efe0" ${O}/><path d="M13 9h6v4h4v6h-4v4h-6v-4H9v-6h4z" fill="#d94a4a" ${O}/>`,
  table: () => `<path d="M3 13h26v4H3z" fill="#a07440" ${O}/><path d="M6 17v9M26 17v9" stroke="#6b4a2b" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="11" cy="11" rx="4" ry="1.8" fill="#e8e2d0" ${O}/><path d="M19 7h4v5h-4z" fill="#d9822b" ${O}/>`,
  crate: () => `<rect x="5" y="8" width="22" height="19" rx="2" fill="#b5824a" ${O}/><path d="M5 8l22 19M27 8L5 27" stroke="#8a5a2b" stroke-width="1.6"/><rect x="5" y="8" width="22" height="19" rx="2" fill="none" stroke="#6b4420" stroke-width="2"/>`,
  house: (c) => `<path d="M4 15L16 5l12 10" fill="none" stroke="#1b1420" stroke-width="1.2"/><path d="M3 15L16 4l13 11z" fill="${c}" ${O}/><path d="M7 15h18v12H7z" fill="#e8d8b8" ${O}/><rect x="14" y="19" width="5" height="8" fill="#6b4a2b" ${O}/><rect x="9" y="18" width="4" height="4" fill="#ffe8a0" ${O}/>`,
  hall: (c) => `<path d="M2 15L16 5l14 10z" fill="${c}" ${O}/><path d="M5 15h22v12H5z" fill="#e8d8b8" ${O}/><path d="M13 27v-6c0-2 1-3 3-3s3 1 3 3v6z" fill="#6b4a2b" ${O}/><rect x="7" y="18" width="3.5" height="4" fill="#ffe8a0" ${O}/><rect x="21.5" y="18" width="3.5" height="4" fill="#ffe8a0" ${O}/>`,
  pot: () => `${steam}<path d="M6 12h20v3c0 7-4 11-10 11S6 22 6 15z" fill="#3a3a44" ${O}/><path d="M4 12h24" stroke="#1b1420" stroke-width="2.4" stroke-linecap="round"/><path d="M8 27l-2 3M24 27l2 3" stroke="#e8792a" stroke-width="2" stroke-linecap="round"/>`,
  shrine: () => `<circle cx="16" cy="11" r="7" fill="#ffe27a" opacity=".45"/><path d="M8 28V14l8-7 8 7v14z" fill="#e8e2d0" ${O}/><path d="M16 12v10M12 16h8" stroke="#c9a64a" stroke-width="2.2" stroke-linecap="round"/>`,
  flame: () => `<path d="M16 3c2 5 8 8 8 15 0 5-4 10-8 10s-8-5-8-10c0-4 2-6 4-8 0 3 1 4 2 5 0-5 1-9 2-12z" fill="#f08a2a" ${O}/><path d="M16 15c2 2 4 4 4 7 0 2-2 4-4 4s-4-2-4-4c0-3 2-5 4-7z" fill="#ffd35c"/>`,
  sun: () => `<circle cx="16" cy="16" r="6.5" fill="#ffd35c" ${O}/><path d="M16 3v4M16 25v4M3 16h4M25 16h4M7 7l3 3M22 22l3 3M25 7l-3 3M10 22l-3 3" stroke="#f2a93b" stroke-width="2" stroke-linecap="round"/>`,
  shield: (c) => `<path d="M16 3l11 4v7c0 7-5 12-11 15C10 26 5 21 5 14V7z" fill="${c}" ${O}/><path d="M16 6l8 3v5c0 5-3.5 9-8 11.5z" fill="${shade(c, 1.35)}"/><path d="M16 10v12M11 15h10" stroke="#f2c14e" stroke-width="2" stroke-linecap="round"/>`,
  stall: () => `<path d="M4 12l3-7h18l3 7z" fill="#d94a4a" ${O}/><path d="M7 5l-1 7M12 5v7M17 5l1 7M22 5l2 7" stroke="#f4efe0" stroke-width="2.4"/><path d="M6 12v15M26 12v15" stroke="#6b4a2b" stroke-width="2.2"/><path d="M5 19h22v4H5z" fill="#a07440" ${O}/><circle cx="11" cy="17" r="2" fill="#e8792a"/><circle cx="16" cy="17" r="2" fill="#7fc45a"/><circle cx="21" cy="17" r="2" fill="#d9c05a"/>`,
  cathedral: () => `<path d="M16 2l3 6v4h-6V8z" fill="#cfc6ae" ${O}/><path d="M5 14l11-4 11 4v14H5z" fill="#e8e2d0" ${O}/><path d="M16 1v4M14.5 2.5h3" stroke="#f2c14e" stroke-width="1.4"/><path d="M13 28v-7a3 3 0 0 1 6 0v7z" fill="#6b4a2b" ${O}/><circle cx="16" cy="16" r="2.4" fill="#7fb8ff" ${O}/><path d="M8 20v4M24 20v4" stroke="#8a93a6" stroke-width="2"/>`,
  scales: () => `<path d="M16 5v21M10 27h12M6 9h20" stroke="#c9a64a" stroke-width="2" stroke-linecap="round"/><path d="M6 9l-3 8h6zM26 9l-3 8h6z" fill="none" stroke="#c9a64a" stroke-width="1.2"/><path d="M2 17a4 2 0 0 0 8 0zM22 17a4 2 0 0 0 8 0z" fill="#f2c14e" ${O}/><circle cx="16" cy="5" r="1.8" fill="#f2c14e" ${O}/>`,
  gem: (c) => `<path d="M8 6h16l5 7-13 15L3 13z" fill="${c}" ${O}/><path d="M3 13h26M12 6l-2 7 6 15 6-15-2-7" stroke="${shade(c, 1.4)}" stroke-width="1" fill="none"/>`,
};

export function artSvg(art, size = 32) {
  const [name, color] = (art ?? 'gem').split(':');
  const draw = GLYPHS[name] ?? GLYPHS.gem;
  return `<svg class="art" viewBox="0 0 32 32" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${draw(color || '#8fa3bf')}</svg>`;
}

// A DOM node for an item, tech or building definition.
export function artIcon(def, cls = 'art-icon') {
  const span = document.createElement('span');
  span.className = cls;
  span.innerHTML = artSvg(def?.art);
  return span;
}
