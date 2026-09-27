import { appearance } from '../render/appearance.js';
import { el, button } from './dom.js';
import { icon } from './icons.js';
import { portrait } from './portrait.js';
import { monsterSvg } from './monsterArt.js';
import { haptic } from './sheets.js';

// Replays a battle report as a little animated fight: monsters across the
// top, the party below, one blow at a time with damage numbers, HP bars
// and falls. Needs a report with `cast` and `events` (see combat.js); older
// reports only have text and are not offered here.

const STEP_MS = 750;
const SPEEDS = [1, 2, 4];
const RESULT = { cleared: 'Victory', victory: 'Victory', repelled: 'Repelled', fled: 'Fled', lost: 'Lost', overrun: 'Overrun' };

export const canWatch = (report) => Boolean(report?.cast && report.events?.length);

export function createBattleViewer(ctx, sound) {
  const root = el('div', 'battle hidden');
  root.id = 'battle';
  document.body.append(root);
  let timer = null;
  let run = null; // { report, i, hp, units, playing, speed }

  function close() {
    clearTimeout(timer);
    run = null;
    root.classList.add('hidden');
    root.replaceChildren();
  }

  function unitArt(c) {
    const { sim, data } = ctx;
    if (!c.hero) {
      const art = el('div', `m-art${data.monstersById[c.id]?.boss ? ' boss' : ''}`);
      art.innerHTML = monsterSvg(data.monstersById[c.id] ?? {});
      return art;
    }
    const h = sim.humans.find((o) => o.id === c.id) ?? sim.dead.find((o) => o.id === c.id);
    const art = el('div', 'h-art');
    try {
      art.append(portrait(appearance(h, false, data), h, 'adult', true, data));
    } catch {
      art.append(icon('people'));
    }
    return art;
  }

  function unit(c) {
    const u = el('div', `b-unit ${c.hero ? 'hero' : 'foe'}`);
    const bar = el('div', 'b-hp');
    const fill = el('div');
    bar.append(fill);
    u.append(unitArt(c), el('div', 'b-name', c.name), bar);
    return { node: u, fill };
  }

  function setHp(k) {
    const c = run.report.cast[k];
    const f = Math.max(0, run.hp[k]) / c.maxHp;
    run.units[k].fill.style.width = `${Math.round(f * 100)}%`;
    run.units[k].fill.className = f < 0.3 ? 'low' : f < 0.6 ? 'mid' : '';
  }

  function float(k, text, cls) {
    const n = el('div', `b-float ${cls}`, text);
    run.units[k].node.append(n);
    setTimeout(() => n.remove(), 1100);
  }

  function pulse(k, cls) {
    const node = run.units[k]?.node;
    if (!node) return;
    node.classList.remove(cls);
    void node.offsetWidth; // restart the animation
    node.classList.add(cls);
  }

  // Plays event i: the blow, its number, and the caption line.
  function play(i) {
    const { report } = run;
    const [a, t, kind, n] = report.events[i];
    run.caption.textContent = report.lines[i] ?? '';
    run.caption.className = `b-caption ${kind}`;
    if (a >= 0 && ['hit', 'crit', 'miss', 'heal'].includes(kind)) pulse(a, report.cast[a].hero ? 'lunge-up' : 'lunge-down');
    if (kind === 'hit' || kind === 'crit') {
      run.hp[t] -= n;
      setHp(t);
      pulse(t, 'hurt');
      float(t, kind === 'crit' ? `${n}!` : `${n}`, kind);
      sound.play(kind);
      if (kind === 'crit') {
        run.stage.classList.remove('shake');
        void run.stage.offsetWidth;
        run.stage.classList.add('shake');
        haptic(25);
      }
    } else if (kind === 'miss') {
      pulse(t, 'dodge');
      float(t, 'Miss', 'miss');
      sound.play('miss');
    } else if (kind === 'heal') {
      run.hp[t] = Math.min(report.cast[t].maxHp, run.hp[t] + n);
      setHp(t);
      pulse(t, 'healed');
      float(t, `+${n}`, 'heal');
      sound.play('heal');
    } else if (kind === 'slain' || kind === 'dead' || kind === 'down') {
      run.units[t].node.classList.add(kind === 'down' ? 'down' : 'fallen');
      sound.play('slain');
      if (report.cast[t].hero) haptic([40, 30, 40]);
    } else if (kind === 'flee') {
      for (const [k, c] of report.cast.entries()) if (c.hero) pulse(k, 'fleeing');
    }
  }

  function tick() {
    if (!run || !run.playing) return;
    if (run.i >= run.report.events.length) return finish();
    play(run.i++);
    run.progress.style.width = `${Math.round((run.i / run.report.events.length) * 100)}%`;
    timer = setTimeout(tick, STEP_MS / run.speed);
  }

  function finish() {
    const { report } = run;
    run.playing = false;
    // Jump everyone to their final state (for "skip").
    while (run.i < report.events.length) {
      const [, t, kind, n] = report.events[run.i];
      if (kind === 'hit' || kind === 'crit') run.hp[t] -= n;
      if (kind === 'heal') run.hp[t] = Math.min(report.cast[t].maxHp, run.hp[t] + n);
      if (['slain', 'dead', 'down'].includes(kind)) run.units[t].node.classList.add(kind === 'down' ? 'down' : 'fallen');
      run.i++;
    }
    report.cast.forEach((c, k) => setHp(k));
    run.progress.style.width = '100%';
    const good = ['cleared', 'victory', 'repelled'].includes(report.result);
    const banner = el('div', `b-banner ${good ? 'good' : 'bad'}`, RESULT[report.result] ?? report.result);
    run.stage.append(banner);
    const after = report.lines.slice(report.events.length);
    run.caption.textContent = after.length ? after.join(' ') : '';
    run.caption.className = 'b-caption';
    sound.play(good ? 'victory' : 'death');
    updateButtons();
  }

  function updateButtons() {
    const done = run.i >= run.report.events.length;
    run.playBtn.replaceChildren(icon(done ? 'restart' : run.playing ? 'pause' : 'play'));
    run.speedBtn.lastChild.textContent = `${run.speed}x`;
  }

  function open(report, title) {
    if (!canWatch(report)) return;
    const speed = run?.speed ?? 1;
    close();
    root.classList.remove('hidden');
    const head = el('div', 'b-head');
    const text = el('div', 'b-title');
    text.append(el('strong', null, title), el('span', null, report.title));
    head.append(text, button('close', '', close));
    head.lastChild.append(icon('close'));
    const stage = el('div', 'b-stage');
    const foes = el('div', 'b-row foes');
    const heroes = el('div', 'b-row heroes');
    const units = report.cast.map((c) => unit(c));
    report.cast.forEach((c, k) => (c.hero ? heroes : foes).append(units[k].node));
    stage.append(foes, el('div', 'b-vs', 'VS'), heroes);
    const track = el('div', 'b-track');
    const progress = el('div');
    track.append(progress);
    const caption = el('div', 'b-caption', 'Tap play to watch the fight.');
    const controls = el('div', 'b-controls');
    const playBtn = button('b-btn primary', '', () => {
      if (run.i >= run.report.events.length) return open(report, title);
      run.playing = !run.playing;
      updateButtons();
      if (run.playing) tick();
      else clearTimeout(timer);
    });
    const speedBtn = button('b-btn', '', () => {
      run.speed = SPEEDS[(SPEEDS.indexOf(run.speed) + 1) % SPEEDS.length];
      updateButtons();
    });
    speedBtn.append(icon('fast'), el('span'));
    const skipBtn = button('b-btn', '', () => {
      clearTimeout(timer);
      if (run.i < run.report.events.length) finish();
    });
    skipBtn.append(icon('faster'), el('span', null, 'Skip'));
    controls.append(speedBtn, playBtn, skipBtn);
    root.append(head, stage, track, caption, controls);
    run = { report, i: 0, hp: report.cast.map((c) => c.hp), units, playing: true, speed, stage, caption, progress, playBtn, speedBtn };
    report.cast.forEach((c, k) => setHp(k));
    updateButtons();
    timer = setTimeout(tick, 500);
  }

  return { open, close };
}
