import { isWalkable } from './world.js';

// Breadth-first search over walkable tiles (4 directions). On a 64x64 grid this
// is cheap, and it finds the nearest goal by walking distance, not straight line.
// Returns { goal, prev, dist, reached }: goal is the first tile matching isGoal
// (or -1), prev links each visited tile to where it came from, dist is the step
// count to each visited tile, reached lists visited tiles nearest-first.
export function bfs(world, data, startIdx, { maxDist = Infinity, isGoal = null } = {}) {
  const W = world.width;
  const n = W * world.height;
  const prev = new Int32Array(n).fill(-1);
  const dist = new Int32Array(n);
  const queue = new Int32Array(n);
  const reached = [];
  let head = 0;
  let tail = 0;
  prev[startIdx] = startIdx;
  queue[tail++] = startIdx;

  while (head < tail) {
    const cur = queue[head++];
    if (isGoal && isGoal(cur)) return { goal: cur, prev, dist, reached };
    reached.push(cur);
    if (dist[cur] >= maxDist) continue;
    const x = cur % W;
    const neighbors = [
      x > 0 ? cur - 1 : -1,
      x < W - 1 ? cur + 1 : -1,
      cur - W,
      cur + W,
    ];
    for (const nb of neighbors) {
      if (nb < 0 || nb >= n || prev[nb] !== -1 || !isWalkable(world, data, nb)) continue;
      prev[nb] = cur;
      dist[nb] = dist[cur] + 1;
      queue[tail++] = nb;
    }
  }
  return { goal: -1, prev, dist, reached };
}

// Tile indices from the step after start up to and including goal.
export function buildPath(prev, startIdx, goalIdx) {
  const path = [];
  for (let c = goalIdx; c !== startIdx; c = prev[c]) path.push(c);
  return path.reverse();
}
