// Sand grains on the plate.
//
// Each frame a grain is kicked in a random direction by a distance
// proportional to how hard the plate shakes beneath it. Where the plate barely
// moves the kick falls under a small friction threshold, so grains wander off
// the loud regions and pile up along the nodal lines, which is exactly what
// Chladni saw. On their own the random kicks leave grains stranded along both
// edges of the quiet band around each line, so each grain also slides a
// little down the slope of the plate's vibration energy, which draws the two
// edges together onto the line itself.

import { amplitudeAt } from './plate.js';

// Small, fast, seedable PRNG (mulberry32).
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEFAULTS = Object.freeze({
  kick: 0.04,
  friction: 0.004,
  drift: 0.7,
  edges: 'bounce',
});

export function createSand(capacity) {
  return {
    x: new Float32Array(capacity),
    y: new Float32Array(capacity),
    count: 0,
    capacity,
  };
}

// Scatter grains uniformly across the plate, replacing what is there.
export function pour(sand, count, rng) {
  sand.count = 0;
  sprinkle(sand, count, rng);
}

// Add grains uniformly on top of what is already there, up to capacity.
export function sprinkle(sand, count, rng) {
  const end = Math.min(sand.capacity, sand.count + Math.max(0, Math.floor(count)));
  for (let k = sand.count; k < end; k++) {
    sand.x[k] = rng() * 2 - 1;
    sand.y[k] = rng() * 2 - 1;
  }
  const added = end - sand.count;
  sand.count = end;
  return added;
}

// Drop grains inside a circle, for painting sand by hand.
export function sprinkleAt(sand, cx, cy, radius, count, rng) {
  let added = 0;
  while (added < count && sand.count < sand.capacity) {
    const r = radius * Math.sqrt(rng());
    const a = rng() * 2 * Math.PI;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (x < -1 || x > 1 || y < -1 || y > 1) continue;
    sand.x[sand.count] = x;
    sand.y[sand.count] = y;
    sand.count++;
    added++;
  }
  return added;
}

function reflect(v) {
  if (v > 1) return 2 - v;
  if (v < -1) return -2 - v;
  return v;
}

// Advance every grain one frame. Returns how many grains fell off the plate
// (always 0 when edges bounce).
export function stepSand(sand, field, size, rng, options = {}) {
  const kick = options.kick ?? DEFAULTS.kick;
  const friction = options.friction ?? DEFAULTS.friction;
  const drift = (options.drift ?? DEFAULTS.drift) * kick;
  const h = 1 / size;
  const spill = (options.edges ?? DEFAULTS.edges) === 'spill';
  let k = 0;
  let lost = 0;
  while (k < sand.count) {
    const x = sand.x[k];
    const y = sand.y[k];
    const amp = amplitudeAt(field, size, x, y);
    // Slope of amp² / 2 by central differences, one grid cell each way.
    const gx = (amplitudeAt(field, size, x + h, y) - amplitudeAt(field, size, x - h, y)) / (2 * h);
    const gy = (amplitudeAt(field, size, x, y + h) - amplitudeAt(field, size, x, y - h)) / (2 * h);
    let nx = x - drift * amp * gx * h;
    let ny = y - drift * amp * gy * h;
    const hop = kick * amp;
    if (hop > friction) {
      const r = hop * Math.sqrt(rng());
      const a = rng() * 2 * Math.PI;
      nx += r * Math.cos(a);
      ny += r * Math.sin(a);
    }
    if (nx < -1 || nx > 1 || ny < -1 || ny > 1) {
      if (spill) {
        const last = sand.count - 1;
        sand.x[k] = sand.x[last];
        sand.y[k] = sand.y[last];
        sand.count = last;
        lost++;
        continue;
      }
      nx = Math.max(-1, Math.min(1, reflect(nx)));
      ny = Math.max(-1, Math.min(1, reflect(ny)));
    }
    sand.x[k] = nx;
    sand.y[k] = ny;
    k++;
  }
  return lost;
}

// Share of grains resting where the plate moves less than `level` of its
// peak. Returns null when the plate is too quiet for the figure to mean much.
export function nodalShare(sand, field, size, peak, level = 0.15, quiet = 0.05) {
  if (sand.count === 0 || peak < quiet) return null;
  const limit = level * peak;
  let still = 0;
  for (let k = 0; k < sand.count; k++) {
    if (amplitudeAt(field, size, sand.x[k], sand.y[k]) < limit) still++;
  }
  return still / sand.count;
}
