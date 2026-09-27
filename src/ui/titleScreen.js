import { createSim } from '../sim/sim.js';
import { readMeta } from './saves.js';
import { $ } from './dom.js';

// The title screen shown over the (paused) world at start-up: Continue the
// autosaved sanctuary, begin a new world, or read How to play. It also
// serves as the tap that lets the browser start audio.

export function createTitleScreen(ctx, { start, replaceSim, showHelp }) {
  const meta = ctx.resumed ? readMeta('auto') : null;
  const cont = $('title-continue');
  if (meta) {
    cont.classList.remove('hidden');
    cont.innerHTML = `Continue<small>${meta.name} · Year ${meta.year}, Day ${meta.day} · ${meta.pop} people</small>`;
  }
  $('title-loading').classList.add('hidden');
  $('title-buttons').classList.add('ready');
  ctx.runner.speed = 0;

  function leave(then) {
    const t = $('title');
    t.classList.add('leaving');
    setTimeout(() => t.classList.add('hidden'), 450);
    then?.();
    start();
  }

  cont.addEventListener('click', () => leave());
  $('title-new').addEventListener('click', () => leave(() => {
    if (ctx.resumed) replaceSim(createSim(ctx.data, String(Date.now() % 1e9)), 'A new world begins');
  }));
  $('title-help').addEventListener('click', () => leave(showHelp));
}
