// Tiny DOM helpers shared by the UI modules.

export const $ = (id) => document.getElementById(id);

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function button(className, text, onClick) {
  const b = el('button', className, text);
  b.addEventListener('click', onClick);
  return b;
}

export function bar(fraction, className = '') {
  const outer = el('div', `bar ${className}`);
  const fill = el('div');
  fill.style.width = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
  outer.append(fill);
  return outer;
}

export function stars(grade, gradeDef) {
  const s = el('span', 'stars', '★'.repeat(grade) + '☆'.repeat(5 - grade));
  s.style.color = gradeDef.color === '#1b1b1b' ? '#c9ced6' : gradeDef.color;
  return s;
}

// Replaces a container's children only when `key` changes, so buttons inside
// aren't rebuilt (and taps lost) on every refresh.
export function renderKeyed(container, key, build) {
  if (container.dataset.key === key) return;
  container.dataset.key = key;
  container.replaceChildren(...build());
}
