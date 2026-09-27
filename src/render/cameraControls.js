import { MAX_ZOOM } from './constants.js';

const TAP_SLOP = 10; // px a finger may move and still count as a tap

// Drag to pan, pinch (or mouse wheel) to zoom, tap to select.
// Phaser's camera zooms around its center, so to keep the point under the
// fingers fixed while zooming we convert screen <-> world by hand.
// getInsets() returns the screen pixels covered by UI bars: { top, bottom }.
export function setupCameraControls(scene, worldW, worldH, onTap, getInsets = () => ({ top: 0, bottom: 0 })) {
  const cam = scene.cameras.main;

  const minZoom = () => {
    const { top, bottom } = getInsets();
    return Math.min(cam.width / worldW, (cam.height - top - bottom) / worldH);
  };
  const clampZoom = (z) => Math.max(minZoom(), Math.min(MAX_ZOOM, z));

  // Bounds are padded so the map can scroll out from under the top and bottom
  // bars, and grown symmetrically when the view is bigger than the map so it
  // stays centered.
  function updateBounds() {
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

  function setZoom(z) {
    cam.setZoom(clampZoom(z));
    updateBounds();
  }

  const toWorld = (sx, sy, zoom = cam.zoom) => ({
    x: cam.scrollX + cam.width / 2 + (sx - cam.width / 2) / zoom,
    y: cam.scrollY + cam.height / 2 + (sy - cam.height / 2) / zoom,
  });

  function zoomAt(newZoom, sx, sy) {
    const anchor = toWorld(sx, sy);
    setZoom(newZoom);
    const z = cam.zoom;
    cam.scrollX = anchor.x - cam.width / 2 - (sx - cam.width / 2) / z;
    cam.scrollY = anchor.y - cam.height / 2 - (sy - cam.height / 2) / z;
  }

  const downPointers = () => scene.input.manager.pointers.filter((p) => p.isDown);
  let pinch = null;
  let tap = null;

  scene.input.on('pointerdown', (p) => {
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
      zoomAt(pinch.zoom * (dist / pinch.dist), mid.x, mid.y);
      cam.scrollX -= (mid.x - pinch.mid.x) / cam.zoom;
      cam.scrollY -= (mid.y - pinch.mid.y) / cam.zoom;
      pinch.mid = mid;
      return;
    }
    if (!p.isDown) return;
    if (tap && Math.hypot(p.x - tap.x, p.y - tap.y) > TAP_SLOP) tap = null;
    if (!tap) {
      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
      cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
    }
  });

  scene.input.on('pointerup', (p) => {
    if (downPointers().length < 2) pinch = null;
    if (tap && downPointers().length === 0) {
      const w = toWorld(p.x, p.y);
      onTap(w.x, w.y);
    }
    tap = null;
  });

  scene.input.on('wheel', (p, objects, dx, dy) => {
    zoomAt(cam.zoom * (dy > 0 ? 0.87 : 1.15), p.x, p.y);
  });

  scene.scale.on('resize', () => setZoom(cam.zoom));

  return {
    centerOn(wx, wy, zoom) {
      setZoom(zoom);
      cam.centerOn(wx, wy);
    },
  };
}
