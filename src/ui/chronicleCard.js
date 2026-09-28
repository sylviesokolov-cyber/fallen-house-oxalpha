import { dateOf } from '../sim/time.js';
import { houseColor } from '../render/appearance.js';
import { tierDef, tierOf } from '../sim/tiers.js';

// "The Chronicle of <place>": a tall image of the sanctuary's story (its
// rulers, the hard times it remembers, its great moments) to share from the
// phone's share sheet, or to save where sharing isn't available.

const W = 1080;
const H = 1920;

function wrap(g, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y);
      line = w;
      y += lineH;
    } else line = test;
  }
  if (line) g.fillText(line, x, y);
  return y + lineH;
}

export function drawChronicle(ctx) {
  const { sim, data } = ctx;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const house = sim.dynasty.house;
  const crest = house ? houseColor(house) : '#c9a64a';
  // Parchment.
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#f3e6c4');
  bg.addColorStop(1, '#e2cc98');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#8a6a3a';
  g.lineWidth = 10;
  g.strokeRect(40, 40, W - 80, H - 80);
  g.lineWidth = 3;
  g.strokeRect(62, 62, W - 124, H - 124);
  // Banner in the ruling house's colour.
  g.fillStyle = crest;
  g.beginPath();
  g.moveTo(W / 2 - 70, 100);
  g.lineTo(W / 2 + 70, 100);
  g.lineTo(W / 2 + 70, 260);
  g.lineTo(W / 2, 220);
  g.lineTo(W / 2 - 70, 260);
  g.closePath();
  g.fill();
  g.fillStyle = '#f2c14e';
  g.beginPath();
  g.arc(W / 2, 160, 26, 0, Math.PI * 2);
  g.fill();

  const serif = (size, weight = 700) => `${weight} ${size}px Cinzel, Georgia, serif`;
  const sans = (size, weight = 700) => `${weight} ${size}px Nunito, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.fillStyle = '#3a2614';
  g.font = serif(40);
  g.fillText('THE CHRONICLE OF', W / 2, 330);
  g.font = serif(84, 900);
  g.fillText(sim.settlement.name, W / 2, 420);
  const date = dateOf(sim.tick, data.config.time);
  g.font = sans(34);
  g.fillStyle = '#6a4a2a';
  g.fillText(`${tierDef(data, tierOf(sim))?.name ?? 'Sanctuary'} · Year ${date.year} · ${sim.humans.length} souls${house ? ` · House ${house}` : ''}`, W / 2, 480);

  let y = 570;
  const heading = (t) => {
    g.textAlign = 'left';
    g.fillStyle = '#8a3b2b';
    g.font = serif(38, 900);
    g.fillText(t, 110, y);
    g.fillStyle = '#b89a6a';
    g.fillRect(110, y + 14, W - 220, 3);
    y += 66;
  };
  const line = (t, sub = '') => {
    g.fillStyle = '#3a2614';
    g.font = sans(32, 800);
    g.textAlign = 'left';
    y = wrap(g, t, 110, y, sub ? W - 420 : W - 220, 40);
    if (sub) {
      g.textAlign = 'right';
      g.fillStyle = '#7a5a3a';
      g.font = sans(28, 700);
      g.fillText(sub, W - 110, y - 40);
    }
    y += 6;
  };

  const rulers = sim.dynasty.rulers.slice(-6);
  if (rulers.length) {
    heading('The Rulers');
    for (const r of rulers) {
      const from = dateOf(r.from, data.config.time).year;
      line(`${r.name} of House ${r.house}`, r.to == null ? `Year ${from} – now` : `Year ${from} – ${dateOf(r.to, data.config.time).year}`);
    }
    y += 16;
  }
  if (sim.eras?.length) {
    heading('Ages Remembered');
    for (const e of sim.eras.slice(-4)) line(e.name);
    y += 16;
  }
  // A spread of the annals: the first moments and the latest, not all alike.
  const annals = sim.annals ?? [];
  const seen = {};
  const kind = (t) => t.split(' ').slice(1, 3).join(' ');
  const great = annals.filter((e) => (seen[kind(e.text)] = (seen[kind(e.text)] ?? 0) + 1) <= 2);
  const picked = great.length > 9 ? [...great.slice(0, 3), ...great.slice(-6)] : great;
  if (picked.length) {
    heading('Great Moments');
    for (const e of picked) {
      if (y > H - 340) break;
      line(e.text, `Year ${dateOf(e.tick, data.config.time).year}`);
    }
  }
  g.textAlign = 'center';
  g.fillStyle = '#8a6a3a';
  g.font = serif(30);
  g.fillText('Written by the unseen god · God Sim', W / 2, H - 110);
  return c;
}

export async function shareChronicle(ctx, toast) {
  const canvas = drawChronicle(ctx);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  const name = `chronicle-${ctx.sim.settlement.name.toLowerCase()}.png`;
  const file = new File([blob], name, { type: 'image/png' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: `The Chronicle of ${ctx.sim.settlement.name}` });
      return;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('The chronicle was saved as an image');
}
