import { MAX_ZOOM } from './constants.js';

const TAP_SLOP = 10; // px a finger may move and still count as a tap
const DOUBLE_TAP_MS = 300;
const FRICTION = 0.9; // per 16ms frame, for the glide after a flick
const STRETCH = 0.18; // how far a pinch may overshoot the zoom limits before springing back

// Drag to pan (with a glide after a flick), pinch (or mouse wheel) to zoom,
// double-tap to zoom in or back out, tap to select.
// Phaser's camera zooms around its center, so to keep the point under the
// fingers fixed while zooming we convert screen <-> world by hand.
// getInsets() returns the screen pixels covered by UI bars: { top, bottom }.
// getSize() returns the world's { w, h } in pixels (it grows when the walls
// move out).
export function setupCameraControls(scene, getSize, onTap, getInsets = () => ({ top: 0, bottom: 0 })) {
  const cam = scene.cameras.main;

  const minZoom = () => {
    const { w: worldW, h: worldH } = getSize();
    const { top, bottom } = getInsets();
    return Math.min(cam.width / worldW, (cam.height - top - bottom) / worldH);
  };
  const clampZoom = (z) => Math.max(minZoom(), Math.min(MAX_ZOOM, z));
  // Past the limits a pinch meets growing resistance (like a rubber band),
  // then eases back when the fingers lift.
  const softZoom = (z) => {
    const lo = minZoom();
    if (z > MAX_ZOOM) return MAX_ZOOM * (1 + STRETCH * (1 - 1 / (1 + (z / MAX_ZOOM - 1) * 2)));
    if (z < lo) return lo * (1 - STRETCH * (1 - 1 / (1 + (1 - z / lo) * 2)));
    return z;
  };

  // Bounds are padded so the map can scroll out from under the top and bottom
  // bars, and grown symmetrically when the view is bigger than the map so it
  // stays centered.
  function updateBounds() {
    const { w: worldW, h: worldH } = getSize();
    const z = cam.zoom;
    const { top: t, bottom: b } = getInsets();
    const top = t / z;
    const content = worldH + top + b / z;
    const viewW = cam.width / z;
    const w = Math.max(worldW, viewW);
    const h = Math.max(content, cam.height / z);
    const x = (worldW - w) / 2;
    const y = -top - (h - content) / 2;
    cam.setBounds(x, y, w, h);
  }

  function setZoom(z, soft = false) {
    cam.setZoom(soft ? softZoom(z) : clampZoom(z));
    updateBounds();
  }

  const toWorld = (sx, sy, zoom = cam.zoom) => ({
    x: cam.scrollX + cam.width / 2 + (sx - cam.width / 2) / zoom,
    y: cam.scrollY + cam.height / 2 + (sy - cam.height / 2) / zoom,
  });

  function zoomAt(newZoom, sx, sy, soft = false) {
    const anchor = toWorld(sx, sy);
    setZoom(newZoom, soft);
    const z = cam.zoom;
    cam.scrollX = anchor.x - cam.width / 2 - (sx - cam.width / 2) / z;
    cam.scrollY = anchor.y - cam.height / 2 - (sy - cam.height / 2) / z;
  }

  const downPointers = () => scene.input.manager.pointers.filter((p) => p.isDown);
  let pinch = null;
  let tap = null;
  let lastTap = null;
  let velocity = { x: 0, y: 0 };
  let zoomAnim = null;
  let skipMove = false;
  const listeners = { pan: [] };

  // Eases the zoom to a target around a screen point (double-tap, the mouse
  // wheel, and springing back after an overshooting pinch). Zooming works in
  // log space so steps feel even whether near or far.
  function animateZoom(to, sx, sy, ms = 260) {
    const from = cam.zoom;
    zoomAnim = { from: Math.log(from), to: Math.log(clampZoom(to)), sx, sy, start: scene.time.now, ms };
  }

  // Glide after a flick, and animate zooms.
  scene.events.on('update', (time, delta) => {
    if (zoomAnim) {
      const t = Math.min(1, (time - zoomAnim.start) / zoomAnim.ms);
      const e = 1 - (1 - t) ** 3;
      zoomAt(Math.exp(zoomAnim.from + (zoomAnim.to - zoomAnim.from) * e), zoomAnim.sx, zoomAnim.sy, true);
      if (t >= 1) zoomAnim = null;
      for (const fn of listeners.pan) fn();
    }
    if (downPointers().length || (Math.abs(velocity.x) < 0.02 && Math.abs(velocity.y) < 0.02)) return;
    cam.scrollX -= velocity.x * delta / cam.zoom;
    cam.scrollY -= velocity.y * delta / cam.zoom;
    const f = FRICTION ** (delta / 16);
    velocity.x *= f;
    velocity.y *= f;
  });

  scene.input.on('pointerdown', (p) => {
    velocity = { x: 0, y: 0 };
    zoomAnim = null;
    const downs = downPointers();
    if (downs.length >= 2) {
      tap = null;
      pinch = null; // re-initialised on the next move
    } else {
      tap = { x: p.x, y: p.y };
    }
  });

  scene.input.on('pointermove', (p) => {
    const downs = downPointers();
    if (downs.length >= 2) {
      const [a, b] = downs;
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (!pinch) pinch = { dist, zoom: cam.zoom, mid };
      zoomAt(pinch.zoom * (dist / pinch.dist), mid.x, mid.y, true);
      cam.scrollX -= (mid.x - pinch.mid.x) / cam.zoom;
      cam.scrollY -= (mid.y - pinch.mid.y) / cam.zoom;
      pinch.mid = mid;
      for (const fn of listeners.pan) fn();
      return;
    }
    if (!p.isDown) return;
    if (skipMove) {
      skipMove = false;
      return;
    }
    if (tap && Math.hypot(p.x - tap.x, p.y - tap.y) > TAP_SLOP) tap = null;
    if (!tap) {
      const dx = p.x - p.prevPosition.x;
      const dy = p.y - p.prevPosition.y;
      cam.scrollX -= dx / cam.zoom;
      cam.scrollY -= dy / cam.zoom;
      // Screen px per ms, smoothed, for the glide.
      const dt = Math.max(1, p.moveTime - (p.prevMoveTime ?? p.moveTime - 16));
      velocity.x = velocity.x * 0.6 + (dx / dt) * 0.4;
      velocity.y = velocity.y * 0.6 + (dy / dt) * 0.4;
      p.prevMoveTime = p.moveTime;
      for (const fn of listeners.pan) fn();
    }
  });

  scene.input.on('pointerup', (p) => {
    if (downPointers().length < 2 && pinch) {
      // Spring back inside the limits around where the fingers were.
      if (cam.zoom !== clampZoom(cam.zoom)) animateZoom(clampZoom(cam.zoom), pinch.mid.x, pinch.mid.y, 220);
      pinch = null;
      tap = null;
      // The finger still down shouldn't jump the view when it moves next.
      velocity = { x: 0, y: 0 };
      skipMove = true;
    }
    if (tap && downPointers().length === 0) {
      velocity = { x: 0, y: 0 };
      const now = scene.time.now;
      if (lastTap && now - lastTap.t < DOUBLE_TAP_MS && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 40) {
        lastTap = null;
        const to = cam.zoom >= 2.8 ? 1.4 : Math.min(MAX_ZOOM, cam.zoom * 1.8);
        animateZoom(to, p.x, p.y, 320);
      } else {
        lastTap = { t: now, x: p.x, y: p.y };
        const w = toWorld(p.x, p.y);
        onTap(w.x, w.y);
      }
    } else if (downPointers().length === 0 && Math.hypot(velocity.x, velocity.y) < 0.15) {
      velocity = { x: 0, y: 0 };
    }
    tap = null;
  });

  scene.input.on('wheel', (p, objects, dx, dy) => {
    const target = zoomAnim ? Math.exp(zoomAnim.to) : cam.zoom;
    animateZoom(target * (dy > 0 ? 0.85 : 1.18), p.x, p.y, 180);
  });

  scene.scale.on('resize', () => setZoom(cam.zoom));

  return {
    centerOn(wx, wy, zoom) {
      setZoom(zoom);
      cam.centerOn(wx, wy);
    },
    // After the world changes size.
    refresh() {
      setZoom(cam.zoom);
    },
    // Called whenever the player moves the view by hand.
    onPan(fn) {
      listeners.pan.push(fn);
    },
  };
}
