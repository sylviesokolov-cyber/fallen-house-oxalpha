import { BootScene } from './scenes/BootScene.js';
import { WorldScene } from './scenes/WorldScene.js';

// Shared app context passed to scenes and UI. `sim` is the only saved part.
// Add ?seed=abc to the URL to replay a specific world.
const params = new URLSearchParams(location.search);
const ctx = {
  seed: params.get('seed') || String(Date.now() % 1e9),
  data: null,
  sim: null,
  runner: null,
  selectedId: null,
  events: new Phaser.Events.EventEmitter(),
};

// Exposed for debugging from the browser console.
window.godSim = ctx;

ctx.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#141b26',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  // Phaser only assigns touches to pointers 1..activePointers-1, so 3 = two fingers.
  input: { activePointers: 3 },
  scene: [new BootScene(ctx), new WorldScene(ctx)],
});
