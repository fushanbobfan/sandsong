import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  modeList, modeShape, modeId, naturalFrequency, resonance, modeWeights,
  sampleField, fieldPeak, amplitudeAt, nextResonance, nearestMode,
  sliderToFrequency, frequencyToSlider, MAX_ORDER, BASE_FREQUENCY,
  MIN_FREQUENCY, MAX_FREQUENCY,
} from '../src/plate.js';

test('mode list is sorted by frequency, unique, and skips the rigid (0,0) mode', () => {
  const modes = modeList();
  const ids = new Set(modes.map((m) => m.id));
  assert.equal(ids.size, modes.length);
  assert.ok(!ids.has('0,0'));
  for (let k = 1; k < modes.length; k++) assert.ok(modes[k].freq >= modes[k - 1].freq);
  // (n, m) pairs with n <= m: diagonal once, off-diagonal twice, minus (0,0).
  const pairs = ((MAX_ORDER + 1) * (MAX_ORDER + 2)) / 2;
  assert.equal(modes.length, 2 * pairs - (MAX_ORDER + 1) - 1);
});

test('natural frequency grows like n² + m² and the minus partner sits higher', () => {
  assert.ok(Math.abs(naturalFrequency(1, 2, 1) - BASE_FREQUENCY * (5 + 3 * 0.38 + 2 * 0.38)) < 1e-9);
  assert.ok(naturalFrequency(1, 2, -1) > naturalFrequency(1, 2, 1));
  assert.ok(naturalFrequency(2, 3, 1) > naturalFrequency(1, 3, -1));
});

test('mode ids show the sign only where there is a partner', () => {
  assert.equal(modeId({ n: 2, m: 2, s: 1 }), '2,2');
  assert.equal(modeId({ n: 1, m: 3, s: 1 }), '1,3+');
  assert.equal(modeId({ n: 1, m: 3, s: -1 }), '1,3−');
});

test('mode shapes are bounded by 2 and have the expected symmetry', () => {
  const plus = { n: 1, m: 3, s: 1 };
  const minus = { n: 1, m: 3, s: -1 };
  for (let k = 0; k < 200; k++) {
    const x = Math.cos(k * 1.7);
    const y = Math.sin(k * 2.3);
    assert.ok(Math.abs(modeShape(plus, x, y)) <= 2 + 1e-12);
    // Swapping x and y leaves "+" modes unchanged and flips "−" modes.
    assert.ok(Math.abs(modeShape(plus, x, y) - modeShape(plus, y, x)) < 1e-12);
    assert.ok(Math.abs(modeShape(minus, x, y) + modeShape(minus, y, x)) < 1e-12);
  }
  // Every "−" mode is still along the diagonal x = y.
  assert.ok(Math.abs(modeShape(minus, 0.3, 0.3)) < 1e-12);
});

test('resonance peaks at the natural frequency with height q', () => {
  const q = 30;
  assert.ok(Math.abs(resonance(500, 500, q) - q) < 1e-9);
  assert.ok(resonance(450, 500, q) < q);
  assert.ok(resonance(550, 500, q) < q);
  assert.ok(Math.abs(resonance(1e-6, 500, q) - 1) < 1e-6);
});

test('no two modes share a frequency: neighbours are at least 1.5 % apart', () => {
  const modes = modeList();
  for (let k = 1; k < modes.length; k++) {
    assert.ok(modes[k].freq / modes[k - 1].freq > 1.015, `${modes[k - 1].id} vs ${modes[k].id}`);
  }
});

test('driving on a resonance makes that mode dominate', () => {
  const modes = modeList();
  for (const target of modes) {
    const weights = modeWeights(modes, target.freq);
    assert.equal(weights[0].mode, target);
    assert.ok(Math.abs(weights[0].weight - 1) < 1e-9);
    assert.ok(weights[1].weight < 0.35, `${target.id} neighbour ${weights[1].mode.id}`);
  }
});

test('drive between resonances gives a weak response', () => {
  const modes = modeList();
  const a = modes.find((m) => m.id === '1,3+');
  const b = modes.find((m) => m.id === '1,3−');
  const mid = Math.sqrt(a.freq * b.freq);
  const peakOn = fieldPeak(sampleField(modeWeights(modes, a.freq), 48));
  const peakOff = fieldPeak(sampleField(modeWeights(modes, mid), 48));
  assert.ok(peakOff < peakOn / 3);
});

test('sampled field matches a direct evaluation of the mode shape', () => {
  const mode = { n: 1, m: 4, s: -1 };
  const size = 16;
  const field = sampleField([{ mode, weight: 0.5 }], size);
  for (const [i, j] of [[0, 0], [3, 11], [15, 7], [8, 8]]) {
    const x = ((i + 0.5) / size) * 2 - 1;
    const y = ((j + 0.5) / size) * 2 - 1;
    assert.ok(Math.abs(field[j * size + i] - 0.5 * modeShape(mode, x, y)) < 1e-5);
  }
});

test('amplitude lookup interpolates |field| and stays finite at the edges', () => {
  const size = 4;
  const field = new Float32Array([
    0, 1, 0, 0,
    0, -1, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 2,
  ]);
  // Cell (1, 0) centre is at x = -0.25, y = -0.75.
  assert.ok(Math.abs(amplitudeAt(field, size, -0.25, -0.75) - 1) < 1e-6);
  // Halfway between rows 0 and 1 of column 1: both have magnitude 1.
  assert.ok(Math.abs(amplitudeAt(field, size, -0.25, -0.5) - 1) < 1e-6);
  assert.ok(Math.abs(amplitudeAt(field, size, 1, 1) - 2) < 1e-6);
  assert.ok(Number.isFinite(amplitudeAt(field, size, -5, 5)));
});

test('next and nearest resonance step through the mode list', () => {
  const modes = modeList();
  const first = modes[0];
  assert.equal(nextResonance(modes, first.freq - 1, 1), first);
  assert.equal(nextResonance(modes, first.freq, 1), modes[1]);
  assert.equal(nextResonance(modes, first.freq, -1), null);
  assert.equal(nextResonance(modes, modes.at(-1).freq, 1), null);
  assert.equal(nearestMode(modes, modes[5].freq * 1.001), modes[5]);
});

test('slider mapping is logarithmic and round-trips', () => {
  assert.equal(sliderToFrequency(0), MIN_FREQUENCY);
  assert.ok(Math.abs(sliderToFrequency(1) - MAX_FREQUENCY) < 1e-9);
  assert.ok(Math.abs(sliderToFrequency(0.5) - Math.sqrt(MIN_FREQUENCY * MAX_FREQUENCY)) < 1e-9);
  for (const f of [65, 300, 1234, 5999]) {
    assert.ok(Math.abs(sliderToFrequency(frequencyToSlider(f)) - f) < 1e-6);
  }
  assert.equal(frequencyToSlider(1), 0);
  assert.equal(frequencyToSlider(1e9), 1);
});
