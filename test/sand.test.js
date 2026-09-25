import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeRng, createSand, pour, sprinkle, sprinkleAt, stepSand, nodalShare,
} from '../src/sand.js';
import { modeList, modeWeights, sampleField, fieldPeak, amplitudeAt } from '../src/plate.js';

function inside(sand) {
  for (let k = 0; k < sand.count; k++) {
    if (Math.abs(sand.x[k]) > 1 || Math.abs(sand.y[k]) > 1) return false;
  }
  return true;
}

test('the PRNG is deterministic per seed and stays in [0, 1)', () => {
  const a = makeRng(7);
  const b = makeRng(7);
  const c = makeRng(8);
  let differs = false;
  for (let k = 0; k < 1000; k++) {
    const va = a();
    assert.equal(va, b());
    assert.ok(va >= 0 && va < 1);
    if (va !== c()) differs = true;
  }
  assert.ok(differs);
});

test('pour replaces grains, sprinkle adds them, both respect capacity', () => {
  const rng = makeRng(1);
  const sand = createSand(100);
  pour(sand, 60, rng);
  assert.equal(sand.count, 60);
  assert.equal(sprinkle(sand, 30, rng), 30);
  assert.equal(sand.count, 90);
  assert.equal(sprinkle(sand, 30, rng), 10);
  assert.equal(sand.count, 100);
  pour(sand, 20, rng);
  assert.equal(sand.count, 20);
  assert.ok(inside(sand));
});

test('sprinkleAt drops grains within the brush and on the plate', () => {
  const rng = makeRng(2);
  const sand = createSand(500);
  assert.equal(sprinkleAt(sand, 0.95, 0.95, 0.2, 200, rng), 200);
  for (let k = 0; k < sand.count; k++) {
    assert.ok(Math.hypot(sand.x[k] - 0.95, sand.y[k] - 0.95) <= 0.2 + 1e-6);
  }
  assert.ok(inside(sand));
});

test('a still plate leaves every grain where it was', () => {
  const rng = makeRng(3);
  const sand = createSand(200);
  pour(sand, 200, rng);
  const before = Array.from(sand.x);
  const field = new Float32Array(16 * 16);
  stepSand(sand, field, 16, rng);
  assert.deepEqual(Array.from(sand.x), before);
});

test('bouncing edges keep every grain on the plate', () => {
  const rng = makeRng(4);
  const sand = createSand(2000);
  pour(sand, 2000, rng);
  const field = new Float32Array(8 * 8).fill(2);
  for (let k = 0; k < 50; k++) {
    assert.equal(stepSand(sand, field, 8, rng, { kick: 0.3 }), 0);
  }
  assert.equal(sand.count, 2000);
  assert.ok(inside(sand));
});

test('spilling edges lose grains and report how many fell', () => {
  const rng = makeRng(5);
  const sand = createSand(2000);
  pour(sand, 2000, rng);
  const field = new Float32Array(8 * 8).fill(2);
  let lost = 0;
  for (let k = 0; k < 30; k++) lost += stepSand(sand, field, 8, rng, { kick: 0.3, edges: 'spill' });
  assert.ok(lost > 0);
  assert.equal(sand.count, 2000 - lost);
  assert.ok(inside(sand));
});

test('on a resonance, grains gather on the nodal lines', () => {
  const size = 96;
  const modes = modeList();
  const mode = modes.find((m) => m.id === '1,3+');
  const field = sampleField(modeWeights(modes, mode.freq), size);
  const peak = fieldPeak(field);
  const rng = makeRng(6);
  const sand = createSand(4000);
  pour(sand, 4000, rng);
  const start = nodalShare(sand, field, size, peak);
  for (let k = 0; k < 400; k++) stepSand(sand, field, size, rng);
  const end = nodalShare(sand, field, size, peak);
  assert.ok(start < 0.3, `start ${start}`);
  assert.ok(end > 0.75, `end ${end}`);
});

test('drift pulls settled grains onto the lines instead of the edges of the quiet band', () => {
  const size = 96;
  const modes = modeList();
  const mode = modes.find((m) => m.id === '2,5+');
  const field = sampleField(modeWeights(modes, mode.freq), size);
  const settle = (drift) => {
    const rng = makeRng(11);
    const sand = createSand(3000);
    pour(sand, 3000, rng);
    for (let k = 0; k < 300; k++) stepSand(sand, field, size, rng, { drift });
    let total = 0;
    for (let k = 0; k < sand.count; k++) total += amplitudeAt(field, size, sand.x[k], sand.y[k]);
    return total / sand.count;
  };
  const without = settle(0);
  const withDrift = settle(0.7);
  assert.ok(withDrift < without * 0.7, `${withDrift} vs ${without}`);
});

test('nodal share is null for an empty plate or a quiet one', () => {
  const sand = createSand(10);
  const field = new Float32Array(4);
  assert.equal(nodalShare(sand, field, 2, 1), null);
  pour(sand, 10, makeRng(9));
  assert.equal(nodalShare(sand, field, 2, 0.001), null);
});
