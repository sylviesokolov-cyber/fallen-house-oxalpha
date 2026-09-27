// Bottom sheets: one open at a time, sliding up on open and down on close.
// Drag a sheet's header (or its handle) down to dismiss it, as in any
// native app. Also the small haptic helper used around the UI.

const CLOSE_MS = 180;
const DISMISS_PX = 90;

export function haptic(pattern = 8) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported.
  }
}

export function createSheets(ids, { onChange }) {
  let current = null;

  function show(id) {
    if (id === current) return;
    const prev = current;
    current = id;
    if (prev) close(document.getElementById(prev));
    if (id) {
      const el = document.getElementById(id);
      el.classList.remove('hidden', 'closing');
      el.style.transform = '';
      el.scrollTop = 0;
    }
    onChange(id);
  }

  function close(el) {
    el.classList.add('closing');
    setTimeout(() => {
      if (el.id !== current) el.classList.add('hidden');
      el.classList.remove('closing');
    }, CLOSE_MS);
  }

  // Swipe down from the top of a sheet to close it.
  for (const id of ids) {
    const el = document.getElementById(id);
    let start = null;
    el.addEventListener('pointerdown', (e) => {
      const r = el.getBoundingClientRect();
      const onHeader = e.clientY - r.top < 64 && !e.target.closest('button');
      if (!onHeader) return;
      start = { y: e.clientY, t: performance.now() };
      el.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
    });
    el.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dy = Math.max(0, e.clientY - start.y);
      el.style.transform = `translateY(${dy}px)`;
    });
    const end = (e) => {
      if (!start) return;
      const dy = e.clientY - start.y;
      const fast = dy > 30 && performance.now() - start.t < 220;
      start = null;
      el.classList.remove('dragging');
      if (dy > DISMISS_PX || fast) show(null);
      else el.style.transform = '';
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  return {
    show,
    get current() {
      return current;
    },
  };
}
