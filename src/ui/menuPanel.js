import { createSim } from '../sim/sim.js';
import { SLOTS, loadFrom, readMeta, saveTo } from './saves.js';
import { $, el, button } from './dom.js';

// The ☰ menu: save slots (with the autosave), starting a new world, sound
// settings and the How to play page.

const AUTOSAVE_MS = 60000;

export function createMenuPanel(ctx, { toast, replaceSim, showPanel, sound }) {
  let confirmNew = false;
  let lastAutosave = performance.now();

  function ago(t) {
    if (!t) return '';
    const min = Math.round((Date.now() - t) / 60000);
    if (min < 1) return ' · just now';
    if (min < 60) return ` · ${min} min ago`;
    const h = Math.round(min / 60);
    return h < 48 ? ` · ${h} h ago` : ` · ${Math.round(h / 24)} days ago`;
  }

  function slotRow(slot) {
    const meta = readMeta(slot);
    const row = el('div', 'slot');
    const text = el('div', 'slot-text');
    text.append(el('strong', null, slot === 'auto' ? 'Autosave' : `Slot ${slot}`));
    text.append(el('span', 'kind', meta
      ? `${meta.name} · Year ${meta.year}, Day ${meta.day} · ${meta.pop} people${ago(meta.savedAt)}`
      : 'Empty'));
    const actions = el('div', 'slot-actions');
    if (slot !== 'auto') {
      actions.append(button('', 'Save', () => {
        try {
          saveTo(slot, ctx.sim, ctx.data);
          toast(`Saved to slot ${slot}`);
          render();
        } catch (e) {
          toast(`Save failed: ${e.message}`);
        }
      }));
    }
    const load = button('', 'Load', () => {
      try {
        replaceSim(loadFrom(slot), `Loaded ${meta?.name ?? 'save'}`);
      } catch (e) {
        toast(`Load failed: ${e.message}`);
      }
    });
    load.disabled = !meta;
    actions.append(load);
    row.append(text, actions);
    return row;
  }

  function toggle(label, key) {
    const b = button(`wide toggle${sound.settings[key] ? ' on' : ''}`, `${label}: ${sound.settings[key] ? 'On' : 'Off'}`, () => {
      sound.set(key, !sound.settings[key]);
      render();
    });
    return b;
  }

  function render() {
    const nodes = [el('h3', null, 'Saves'), ...SLOTS.map(slotRow)];
    const fresh = button(`wide${confirmNew ? ' danger' : ''}`, confirmNew ? 'Tap again to start a new world' : 'New world', () => {
      if (!confirmNew) {
        confirmNew = true;
        render();
        setTimeout(() => {
          confirmNew = false;
          render();
        }, 3000);
        return;
      }
      confirmNew = false;
      replaceSim(createSim(ctx.data, String(Date.now() % 1e9)), 'A new world begins');
    });
    nodes.push(fresh, el('h3', null, 'Settings'), toggle('Sound', 'sound'), toggle('Music', 'music'));
    nodes.push(button('wide', 'How to play', () => showPanel('help')));
    $('menu-body').replaceChildren(...nodes);
  }

  function autosave(now, force = false) {
    if (!force && now - lastAutosave < AUTOSAVE_MS) return;
    lastAutosave = now;
    try {
      saveTo('auto', ctx.sim, ctx.data);
    } catch {
      // Storage full or unavailable: skip this autosave quietly.
    }
  }
  // Save when the player leaves the page (switching apps on a phone).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) autosave(performance.now(), true);
  });

  return { render, autosave };
}
