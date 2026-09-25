// Nodal-line thumbnails for the mode atlas: a small picture of where each
// mode's plate stays still, drawn straight from the mode shape.

import { modeShape } from './plate.js';

// Mark every pixel whose cell straddles a sign change of the mode shape.
// Sampling the four corners of each pixel catches lines of any direction.
export function nodalMask(mode, size) {
  const corners = new Float32Array((size + 1) * (size + 1));
  for (let j = 0; j <= size; j++) {
    const y = (j / size) * 2 - 1;
    for (let i = 0; i <= size; i++) {
      corners[j * (size + 1) + i] = modeShape(mode, (i / size) * 2 - 1, y);
    }
  }
  const mask = new Uint8Array(size * size);
  const eps = 1e-9;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const a = corners[j * (size + 1) + i];
      const b = corners[j * (size + 1) + i + 1];
      const c = corners[(j + 1) * (size + 1) + i];
      const d = corners[(j + 1) * (size + 1) + i + 1];
      const lo = Math.min(a, b, c, d);
      const hi = Math.max(a, b, c, d);
      if (lo <= eps && hi >= -eps) mask[j * size + i] = 1;
    }
  }
  return mask;
}

// Paint a mask into an RGBA buffer: lines in `ink`, the rest in `paper`.
export function paintMask(buffer, mask, ink, paper) {
  for (let p = 0; p < mask.length; p++) {
    const colour = mask[p] ? ink : paper;
    const o = p * 4;
    buffer[o] = colour[0];
    buffer[o + 1] = colour[1];
    buffer[o + 2] = colour[2];
    buffer[o + 3] = 255;
  }
}

// Group modes into rows of similar frequency for the atlas: one row per
// value of n + m, the rough "order" of the figure.
export function atlasRows(modes) {
  const rows = new Map();
  for (const mode of modes) {
    const order = mode.n + mode.m;
    if (!rows.has(order)) rows.set(order, []);
    rows.get(order).push(mode);
  }
  return [...rows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([order, list]) => ({ order, modes: list.sort((a, b) => a.freq - b.freq) }));
}
