// Sound, synthesised with WebAudio so there are no audio files to host:
// short effects for taps, powers and life's big moments, and an optional
// quiet music bed (slow pentatonic notes over a soft drone). Browsers only
// allow audio after the first touch, so the context starts then.

const SETTINGS_KEY = 'godsim.settings';
const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);
const PENTATONIC = [0, 2, 4, 7, 9];

export function createSound() {
  const settings = loadSettings();
  let ac = null;
  let master = null;
  let musicBus = null;
  let musicTimer = null;
  let drone = null;

  function start() {
    if (ac) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    ac = new Ctx();
    master = ac.createGain();
    master.gain.value = 0.5;
    master.connect(ac.destination);
    musicBus = ac.createGain();
    musicBus.gain.value = 0;
    musicBus.connect(master);
    if (settings.music) startMusic();
  }
  window.addEventListener('pointerdown', start, { once: true, capture: true });
  // Mobile browsers suspend audio in the background.
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend();
    else ac.resume();
  });

  // One enveloped oscillator note.
  function tone(freq, { at = 0, dur = 0.3, type = 'sine', vol = 0.2, bus = master, glide = 0 } = {}) {
    const t = ac.currentTime + at;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (glide) osc.frequency.exponentialRampToValueAtTime(freq * glide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // A burst of filtered noise: knocks, whooshes.
  function noise({ at = 0, dur = 0.2, freq = 800, q = 1, vol = 0.2, sweep = 0 } = {}) {
    const t = ac.currentTime + at;
    const len = Math.ceil(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur);
    f.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
  }

  const arp = (notes, step, opts) => notes.forEach((n, i) => tone(NOTE(n), { ...opts, at: i * step }));

  const EFFECTS = {
    tap: () => tone(NOTE(84), { dur: 0.05, vol: 0.05, type: 'triangle' }),
    bless: () => arp([72, 76, 79, 84, 88], 0.07, { dur: 0.6, vol: 0.12, type: 'sine' }),
    inspire: () => {
      tone(NOTE(81), { dur: 1.2, vol: 0.1 });
      tone(NOTE(88), { at: 0.15, dur: 1.2, vol: 0.08 });
    },
    omen: () => {
      for (const n of [48, 55, 60, 64]) tone(NOTE(n), { dur: 2.2, vol: 0.07, type: 'triangle' });
      noise({ dur: 1.5, freq: 300, sweep: 4, vol: 0.05 });
    },
    portal: () => {
      noise({ dur: 1.1, freq: 200, sweep: 8, q: 3, vol: 0.16 });
      tone(NOTE(43), { dur: 1.2, vol: 0.12, glide: 2 });
    },
    birth: () => arp([79, 84, 88], 0.12, { dur: 0.7, vol: 0.1, type: 'triangle' }),
    death: () => {
      tone(NOTE(45), { dur: 2.6, vol: 0.16 });
      tone(NOTE(57), { dur: 2.2, vol: 0.06 });
    },
    discover: () => arp([84, 88, 91, 96], 0.05, { dur: 0.35, vol: 0.07, type: 'sine' }),
    build: () => {
      noise({ dur: 0.08, freq: 500, q: 4, vol: 0.3 });
      noise({ at: 0.16, dur: 0.08, freq: 420, q: 4, vol: 0.3 });
    },
    victory: () => arp([60, 64, 67, 72, 76, 79], 0.1, { dur: 0.5, vol: 0.08, type: 'triangle' }),
    love: () => arp([76, 81], 0.18, { dur: 0.8, vol: 0.09, type: 'sine' }),
    hit: () => noise({ dur: 0.07, freq: 900, q: 1.5, vol: 0.25 }),
    crit: () => {
      noise({ dur: 0.12, freq: 1400, q: 1, vol: 0.35 });
      tone(NOTE(55), { dur: 0.15, vol: 0.12, type: 'square', glide: 0.5 });
    },
    miss: () => noise({ dur: 0.12, freq: 2500, q: 0.7, vol: 0.08 }),
    heal: () => arp([79, 84], 0.06, { dur: 0.3, vol: 0.06, type: 'sine' }),
    slain: () => tone(NOTE(48), { dur: 0.35, vol: 0.12, type: 'sawtooth', glide: 0.4 }),
  };

  function play(name) {
    if (!ac || !settings.sound || !EFFECTS[name]) return;
    EFFECTS[name]();
  }

  // A few notes every several seconds, drifting through a pentatonic scale,
  // over a quiet drone. Kept very soft so it never gets in the way.
  function startMusic() {
    if (!ac || musicTimer) return;
    musicBus.gain.setTargetAtTime(0.55, ac.currentTime, 2);
    drone = ac.createOscillator();
    const dg = ac.createGain();
    drone.type = 'sine';
    drone.frequency.value = NOTE(38);
    dg.gain.value = 0.035;
    drone.connect(dg).connect(musicBus);
    drone.start();
    let root = 60;
    const phrase = () => {
      const count = 1 + Math.floor(Math.random() * 3);
      for (let k = 0; k < count; k++) {
        const deg = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
        const oct = Math.random() < 0.3 ? 12 : 0;
        tone(NOTE(root + deg + oct), { at: k * 0.6, dur: 3, vol: 0.05, type: 'sine', bus: musicBus });
      }
      if (Math.random() < 0.15) root = [55, 57, 60, 62][Math.floor(Math.random() * 4)];
      musicTimer = setTimeout(phrase, 3500 + Math.random() * 4000);
    };
    phrase();
  }

  function stopMusic() {
    clearTimeout(musicTimer);
    musicTimer = null;
    if (!ac) return;
    musicBus.gain.setTargetAtTime(0, ac.currentTime, 0.5);
    drone?.stop(ac.currentTime + 2);
    drone = null;
  }

  function set(key, value) {
    settings[key] = value;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Storage may be unavailable (private mode); settings then last this session.
    }
    if (key === 'music') (value ? startMusic : stopMusic)();
  }

  return { play, set, settings };
}

function loadSettings() {
  try {
    return { sound: true, music: true, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return { sound: true, music: true };
  }
}
