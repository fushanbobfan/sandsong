import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nodalMask, paintMask, atlasRows } from '../src/atlas.js';
import { modeList, modeShape } from '../src/plate.js';

const modes = modeList();

function count(mask) {
  let n = 0;
  for (const v of mask) n += v;
  return n;
}

test('the (0,1+) mode has a single nodal line along the anti-diagonal', () => {
  const size = 32;
  const mask = nodalMask({ n: 0, m: 1, s: 1 }, size);
  // cos(πu) + cos(πv) vanishes where u + v = 1.
  for (let i = 0; i < size; i++) assert.equal(mask[(size - 1 - i) * size + i], 1);
  assert.equal(mask[0], 0);
  assert.equal(mask[size * size - 1], 0);
  assert.ok(count(mask) < 4 * size);
});

test('every minus mode is still along the main diagonal', () => {
  const size = 24;
  for (const mode of modes.filter((m) => m.s < 0)) {
    const mask = nodalMask(mode, size);
    for (let i = 0; i < size; i++) assert.equal(mask[i * size + i], 1, mode.id);
  }
});

test('masked pixels really straddle a sign change or zero', () => {
  const size = 20;
  const mode = modes.find((m) => m.id === '2,5+');
  const mask = nodalMask(mode, size);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      if (!mask[j * size + i]) {
        const x0 = (i / size) * 2 - 1;
        const y0 = (j / size) * 2 - 1;
        const x1 = ((i + 1) / size) * 2 - 1;
        const y1 = ((j + 1) / size) * 2 - 1;
        const v = [modeShape(mode, x0, y0), modeShape(mode, x1, y0), modeShape(mode, x0, y1), modeShape(mode, x1, y1)];
        assert.ok(v.every((z) => z > 0) || v.every((z) => z < 0));
      }
    }
  }
});

test('higher modes draw more nodal line than lower ones', () => {
  const size = 48;
  const low = count(nodalMask(modes.find((m) => m.id === '0,1+'), size));
  const high = count(nodalMask(modes.find((m) => m.id === '5,6+'), size));
  assert.ok(high > 3 * low);
});

test('painting a mask writes ink on lines and paper elsewhere', () => {
  const mask = new Uint8Array([1, 0]);
  const buffer = new Uint8ClampedArray(8);
  paintMask(buffer, mask, [1, 2, 3], [9, 8, 7]);
  assert.deepEqual(Array.from(buffer), [1, 2, 3, 255, 9, 8, 7, 255]);
});

test('atlas rows group every mode once by n + m in rising order', () => {
  const rows = atlasRows(modes);
  assert.equal(rows.reduce((sum, r) => sum + r.modes.length, 0), modes.length);
  for (let k = 1; k < rows.length; k++) assert.ok(rows[k].order > rows[k - 1].order);
  for (const row of rows) {
    for (const mode of row.modes) assert.equal(mode.n + mode.m, row.order);
    for (let k = 1; k < row.modes.length; k++) assert.ok(row.modes[k].freq > row.modes[k - 1].freq);
  }
  assert.equal(rows[0].order, 1);
});
