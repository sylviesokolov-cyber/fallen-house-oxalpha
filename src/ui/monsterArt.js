// Monster portraits for the battle viewer, drawn as SVG from each monster's
// `look` in data/monsters.json: a shape, a body colour, and maybe a crown.

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(Math.min(255, Math.max(0, f < 1 ? v * f : v + (255 - v) * (f - 1)))));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const eyes = (x1, x2, y, r = 2.6, color = '#fff6c8') =>
  `<circle cx="${x1}" cy="${y}" r="${r}" fill="${color}"/><circle cx="${x2}" cy="${y}" r="${r}" fill="${color}"/>` +
  `<circle cx="${x1 + 0.6}" cy="${y + 0.4}" r="${r * 0.45}" fill="#1a1020"/><circle cx="${x2 + 0.6}" cy="${y + 0.4}" r="${r * 0.45}" fill="#1a1020"/>`;

const SHAPES = {
  beast: (c, d, l) => `
    <path d="M10 44c0-12 10-20 24-20 10 0 18 6 20 14l4 2-2 6H14c-3 0-4-1-4-2z" fill="${c}"/>
    <path d="M44 26l4-8 3 9z" fill="${d}"/><path d="M38 25l2-7 4 7z" fill="${d}"/>
    <path d="M12 44c6-4 14-4 20 0" stroke="${l}" stroke-width="2" fill="none" opacity=".5"/>
    <rect x="16" y="44" width="5" height="8" rx="2" fill="${d}"/><rect x="40" y="44" width="5" height="8" rx="2" fill="${d}"/>
    <path d="M10 40c-4 0-6-4-4-6" stroke="${d}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M56 40l-4 2 4 2z" fill="#f4efe0"/>${eyes(46, 51, 33, 2.2, '#ffd34d')}`,
  slime: (c, d, l) => `
    <path d="M8 50c0-16 10-30 24-30s24 14 24 30c0 3-3 4-6 4H14c-3 0-6-1-6-4z" fill="${c}" opacity=".92"/>
    <ellipse cx="22" cy="30" rx="6" ry="4" fill="${l}" opacity=".7"/>
    ${eyes(26, 38, 38, 3.2)}<path d="M27 46q5 3 10 0" stroke="${d}" stroke-width="2" fill="none"/>`,
  plant: (c, d, l) => `
    <path d="M32 54V30" stroke="#4a7a3a" stroke-width="5"/>
    <path d="M32 44c-10 0-16-6-18-12 8 0 14 4 18 12zM32 40c10 0 16-6 18-12-8 0-14 4-18 12z" fill="#5d9a44"/>
    <circle cx="32" cy="22" r="13" fill="${c}"/><circle cx="26" cy="18" r="3" fill="${l}"/><circle cx="38" cy="26" r="2" fill="${l}"/>
    <path d="M24 26q8 6 16 0" stroke="${d}" stroke-width="3" fill="none"/>${eyes(27, 37, 19, 2)}`,
  humanoid: (c, d, l) => `
    <path d="M18 56l4-22h20l4 22z" fill="${d}"/>
    <path d="M20 36c0-5 5-8 12-8s12 3 12 8l-2 8H22z" fill="${shade(c, 0.8)}"/>
    <circle cx="32" cy="20" r="11" fill="${c}"/>
    <path d="M21 16l-6-4 7 1zM43 16l6-4-7 1z" fill="${c}"/>
    <rect x="44" y="24" width="3" height="26" rx="1" fill="#c9ccd6"/><rect x="41" y="40" width="9" height="3" rx="1" fill="#6a5040"/>
    <path d="M26 26q6 3 12 0" stroke="${d}" stroke-width="2" fill="none"/>${eyes(27, 37, 19, 2.3, '#ffe36a')}`,
  skeleton: (c, d) => `
    <path d="M26 34h12M24 39h16M25 44h14" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <path d="M32 30v20" stroke="${c}" stroke-width="3"/><path d="M26 50l-3 6M38 50l3 6" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <path d="M22 34l-6 10M42 34l8 6" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <path d="M50 40l6-18" stroke="#9aa0ad" stroke-width="3"/>
    <path d="M22 18c0-7 5-11 10-11s10 4 10 11c0 5-2 7-4 8v3H26v-3c-2-1-4-3-4-8z" fill="${c}"/>
    <circle cx="27.5" cy="18" r="3.2" fill="#140c1c"/><circle cx="36.5" cy="18" r="3.2" fill="#140c1c"/>
    <circle cx="27.5" cy="18" r="1.1" fill="#7fffd0"/><circle cx="36.5" cy="18" r="1.1" fill="#7fffd0"/>
    <path d="M28 27v-2M32 27v-2M36 27v-2" stroke="#140c1c" stroke-width="1.2"/>`,
  golem: (c, d, l) => `
    <path d="M14 24l8-8h20l8 8v16l-6 8H20l-6-8z" fill="${c}"/>
    <path d="M22 16l4 10-6 8M42 16l-3 12 7 6M26 48l6-10 6 10" stroke="${d}" stroke-width="2" fill="none"/>
    <path d="M22 18l8-1 2 6z" fill="${l}" opacity=".6"/>
    <rect x="16" y="48" width="10" height="8" rx="2" fill="${d}"/><rect x="38" y="48" width="10" height="8" rx="2" fill="${d}"/>
    <rect x="6" y="28" width="8" height="16" rx="3" fill="${d}"/><rect x="50" y="28" width="8" height="16" rx="3" fill="${d}"/>
    <rect x="25" y="26" width="5" height="3" fill="#ffcf4d"/><rect x="34" y="26" width="5" height="3" fill="#ffcf4d"/>`,
  spirit: (c, d, l) => `
    <path d="M14 30c0-11 8-19 18-19s18 8 18 19v22l-5-4-4 5-5-5-4 5-5-5-4 5-4-4z" fill="${c}" opacity=".88"/>
    <path d="M20 26c2-6 6-9 12-10" stroke="${l}" stroke-width="2" fill="none" opacity=".6"/>
    <ellipse cx="26" cy="28" rx="3.5" ry="5" fill="#0d0a18"/><ellipse cx="38" cy="28" rx="3.5" ry="5" fill="#0d0a18"/>
    <circle cx="26" cy="29" r="1.4" fill="#bfe6ff"/><circle cx="38" cy="29" r="1.4" fill="#bfe6ff"/>
    <ellipse cx="32" cy="39" rx="4" ry="3" fill="#0d0a18" opacity=".8"/>`,
  serpent: (c, d, l) => `
    <path d="M8 52c10 4 22 2 26-6s-6-12-2-20 14-10 20-4" stroke="${c}" stroke-width="11" fill="none" stroke-linecap="round"/>
    <path d="M8 52c10 4 22 2 26-6s-6-12-2-20 14-10 20-4" stroke="${l}" stroke-width="3" fill="none" stroke-dasharray="3 5" opacity=".6"/>
    <path d="M44 14c4-6 14-6 16 2 1 6-4 10-10 10-5 0-9-4-6-12z" fill="${c}"/>
    <path d="M47 12l-3-7 6 5zM55 10l2-7 1 8z" fill="${d}"/>
    <path d="M58 20l4 1-3 2" stroke="#e8394a" stroke-width="1.5" fill="none"/>${eyes(50, 56, 15, 2, '#ffe04d')}`,
  flyer: (c, d, l) => `
    <path d="M32 30c-6-10-16-14-26-10 4 4 4 10 2 14 6-2 10 0 12 4 2-6 6-8 12-8z" fill="${d}"/>
    <path d="M32 30c6-10 16-14 26-10-4 4-4 10-2 14-6-2-10 0-12 4-2-6-6-8-12-8z" fill="${d}"/>
    <ellipse cx="32" cy="34" rx="8" ry="10" fill="${c}"/><path d="M26 25l2-7 3 6zM38 25l-2-7-3 6z" fill="${c}"/>
    <path d="M28 20l3 4" stroke="${l}" stroke-width="1.5"/><path d="M29 40l1 3 2-3 2 3 1-3" stroke="#fff" stroke-width="1.2" fill="none"/>
    ${eyes(28.5, 35.5, 32, 2, '#ff5a6a')}`,
  book: (c, d, l) => `
    <path d="M10 26l22-8 22 8v24l-22 6-22-6z" fill="${c}"/>
    <path d="M32 18v38" stroke="${d}" stroke-width="2"/>
    <path d="M13 30l17-5v26l-17-4z" fill="#efe4c8"/><path d="M51 30l-17-5v26l17-4z" fill="#efe4c8"/>
    <path d="M14 44l3 4 3-4 3 4 3-4 3 4" stroke="#b02a2a" stroke-width="2.5" fill="none"/>
    <path d="M16 36h10M16 33h8M38 33h10M38 36h8" stroke="#8a7a5a" stroke-width="1"/>
    ${eyes(22, 42, 28, 2.4, '#ffe45a')}`,
};

const CROWN = '<path d="M22 8l3 6 4-7 3 7 3-7 4 7 3-6v8H22z" fill="#f2c14e" stroke="#8a5a10" stroke-width="1"/><circle cx="32" cy="12" r="1.4" fill="#e03a5a"/>';

export function monsterSvg(monster) {
  const look = monster.look ?? { shape: 'beast', color: '#888888' };
  const c = look.color;
  const draw = SHAPES[look.shape] ?? SHAPES.beast;
  const glow = monster.boss ? `<ellipse cx="32" cy="34" rx="30" ry="26" fill="${c}" opacity=".18"/>` : '';
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">${glow}<ellipse cx="32" cy="57" rx="20" ry="4" fill="#000" opacity=".35"/>${draw(c, shade(c, 0.6), shade(c, 1.5))}${look.crown ? CROWN : ''}</svg>`;
}
