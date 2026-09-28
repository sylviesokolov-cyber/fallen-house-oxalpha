import { $, el, button } from './dom.js';
import { haptic } from './sheets.js';

// The first minutes of a new world: a few coach marks that each wait for the
// player to do the thing (look around, meet someone, bless them, find the
// goals, speed up time). A glowing ring points at what to tap. Shown once;
// the menu can replay it.

const DONE_KEY = 'godsim.tutorialDone';

const STEPS = [
  { text: 'This is your sanctuary. Its people live their own lives, and you are their unseen god. Drag to look around; pinch to zoom.', wait: 'camera', next: true },
  { text: 'Tap anyone on the map to meet them.', wait: 'panel:inspect' },
  { text: 'Each person has needs, thoughts, friends and a life story. Close their sheet when you have looked.', target: '#inspect-close', wait: 'panel:' },
  { text: 'Tap Bless, then tap someone: it heals them and helps them learn. People who see a miracle start to believe, and believers pray, which gives you Faith.', target: '[data-power="bless"]', wait: 'power:bless' },
  { text: 'Open the Tribe to see how your sanctuary is doing.', target: '#btn-tribe', wait: 'panel:tribe' },
  { text: 'Goals shows what to aim for next. Every milestone rewards Faith.', target: '#tribe [data-tab="goals"]', wait: 'click:#tribe [data-tab="goals"]' },
  { text: 'Close the sheet, then speed up time here. Their story is yours to watch, and to shape.', target: '#btn-speed', wait: 'click:#btn-speed' },
];

const stored = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const store = (key, v) => {
  try {
    localStorage.setItem(key, v);
  } catch {
    // Private mode: the tutorial just shows again next time.
  }
};

export function createTutorial(ctx, { toast }) {
  let step = -1;
  let timer = null;
  const card = el('div', 'coach hidden');
  const ring = el('div', 'coach-ring hidden');
  document.body.append(ring, card);

  function place() {
    const s = STEPS[step];
    const target = s?.target && document.querySelector(s.target);
    const r = target?.getBoundingClientRect();
    const visible = r && r.width > 0 && r.height > 0;
    ring.classList.toggle('hidden', !visible);
    if (visible) Object.assign(ring.style, { left: `${r.left - 6}px`, top: `${r.top - 6}px`, width: `${r.width + 12}px`, height: `${r.height + 12}px` });
    // The card sits on the side of the screen away from what it points at.
    const low = visible && r.top + r.height / 2 > window.innerHeight / 2;
    card.classList.toggle('top', low || !visible);
    card.classList.toggle('bottom', !low && visible);
  }

  function show() {
    const s = STEPS[step];
    const skip = button('coach-skip', 'Skip', finish);
    const text = el('div', 'coach-text', s.text);
    const count = el('div', 'coach-count', `${step + 1} / ${STEPS.length}`);
    const row = el('div', 'coach-row');
    row.append(count, skip);
    if (s.next) row.append(button('coach-next', 'Next', advance));
    card.replaceChildren(text, row);
    card.classList.remove('hidden');
    card.classList.remove('pop');
    void card.offsetWidth;
    card.classList.add('pop');
    place();
  }

  function advance() {
    haptic(10);
    step++;
    if (step >= STEPS.length) return finish(true);
    show();
  }

  function finish(completed = false) {
    step = -1;
    clearInterval(timer);
    card.classList.add('hidden');
    ring.classList.add('hidden');
    store(DONE_KEY, '1');
    if (completed === true) toast('Your story begins');
  }

  function start() {
    step = 0;
    clearInterval(timer);
    timer = setInterval(place, 250);
    show();
  }

  // Each step waits for its signal.
  const hit = (signal) => {
    if (step >= 0 && STEPS[step].wait === signal) advance();
  };
  ctx.events.on('camera-moved', () => hit('camera'));
  ctx.events.on('panel', (id) => hit(`panel:${id ?? ''}`));
  ctx.events.on('power-used', ({ powerId }) => hit(`power:${powerId}`));
  document.addEventListener('click', (e) => {
    const s = STEPS[step];
    if (s?.wait.startsWith('click:') && e.target.closest(s.wait.slice(6))) setTimeout(() => hit(s.wait), 0);
  }, true);

  return {
    start,
    // New players only.
    maybeStart() {
      if (!stored(DONE_KEY)) setTimeout(start, 900);
    },
  };
}

export const tutorialSeen = () => !!stored(DONE_KEY);
