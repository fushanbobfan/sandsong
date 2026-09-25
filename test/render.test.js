import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PALETTES, paletteById, toPixel, toPlate, paintPlate, paintSand, formatFrequency,
} from '../src/render.js';
import { createSand } from '../src/sand.js';

function pixel(buffer, width, px, py) {
  const o = (py * width + px) * 4;
  return Array.from(buffer.slice(o, o + 4));
}

test('palettes have unique ids and fall back to the first', () => {
  assert.equal(new Set(PALETTES.map((p) => p.id)).size, PALETTES.length);
  assert.equal(paletteById('slate').id, 'slate');
  assert.equal(paletteById('nope'), PALETTES[0]);
});

test('pixel mapping covers the image and inverts at pixel centres', () => {
  assert.equal(toPixel(-1, 100), 0);
  assert.equal(toPixel(1, 100), 99);
  assert.equal(toPixel(-3, 100), 0);
  assert.equal(toPixel(0, 100), 50);
  for (const px of [0, 17, 50, 99]) assert.equal(toPixel(toPlate(px, 100), 100), px);
});

test('a plain plate is filled with the plate colour', () => {
  const width = 8;
  const buffer = new Uint8ClampedArray(width * width * 4);
  const palette = PALETTES[0];
  paintPlate(buffer, width, palette);
  assert.deepEqual(pixel(buffer, width, 3, 5), [...palette.plate, 255]);
});

test('the overlay tints moving regions by sign and leaves nodes plate-coloured', () => {
  const width = 4;
  const size = 2;
  const buffer = new Uint8ClampedArray(width * width * 4);
  const palette = PALETTES[1];
  const field = new Float32Array([1, -1, 0, 0.5]);
  paintPlate(buffer, width, palette, { field, size, peak: 1, strength: 1 });
  assert.deepEqual(pixel(buffer, width, 0, 0), [...palette.plus, 255]);
  assert.deepEqual(pixel(buffer, width, 3, 0), [...palette.minus, 255]);
  assert.deepEqual(pixel(buffer, width, 0, 3), [...palette.plate, 255]);
  const half = pixel(buffer, width, 3, 3);
  for (let c = 0; c < 3; c++) {
    const lo = Math.min(palette.plate[c], palette.plus[c]);
    const hi = Math.max(palette.plate[c], palette.plus[c]);
    assert.ok(half[c] >= lo && half[c] <= hi);
  }
});

test('grains brighten their pixel and piles move further towards the sand colour', () => {
  const width = 10;
  const buffer = new Uint8ClampedArray(width * width * 4);
  const palette = PALETTES[0];
  paintPlate(buffer, width, palette);
  const sand = createSand(4);
  sand.x.set([0.05, 0.05, 0.05, -0.95]);
  sand.y.set([0.05, 0.05, 0.05, -0.95]);
  sand.count = 4;
  paintSand(buffer, width, sand, palette);
  const pile = pixel(buffer, width, 5, 5);
  const lone = pixel(buffer, width, 0, 0);
  const halo = pixel(buffer, width, 5, 4);
  const bare = pixel(buffer, width, 7, 2);
  assert.deepEqual(bare, [...palette.plate, 255]);
  assert.ok(lone[0] > palette.plate[0]);
  assert.ok(pile[0] > lone[0]);
  assert.ok(pile[0] <= palette.sand[0]);
  assert.ok(halo[0] > palette.plate[0] && halo[0] < pile[0]);
  // Diagonal neighbours are left alone.
  assert.deepEqual(pixel(buffer, width, 6, 6), [...palette.plate, 255]);
});

test('frequencies read in Hz or kHz with sensible precision', () => {
  assert.equal(formatFrequency(82.8), '82.8 Hz');
  assert.equal(formatFrequency(510.4), '510 Hz');
  assert.equal(formatFrequency(1234.5), '1.23 kHz');
});
