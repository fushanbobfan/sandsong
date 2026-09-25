import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  responseAt, toDecibels, sampleSpectrum, columnOf, frequencyAtColumn,
} from '../src/spectrum.js';
import { modeList, MIN_FREQUENCY, MAX_FREQUENCY } from '../src/plate.js';

const modes = modeList();

test('response is about 1 on a resonance and much lower between them', () => {
  const a = modes.find((m) => m.id === '1,3+');
  const b = modes.find((m) => m.id === '1,3−');
  const on = responseAt(modes, a.freq);
  assert.ok(on >= 1 && on < 1.1, `on ${on}`);
  assert.ok(responseAt(modes, Math.sqrt(a.freq * b.freq)) < on / 2);
});

test('decibels are 0 at 1, -20 at 0.1 and never below the floor', () => {
  assert.equal(toDecibels(1), 0);
  assert.ok(Math.abs(toDecibels(0.1) + 20) < 1e-9);
  assert.equal(toDecibels(0), -60);
  assert.equal(toDecibels(1e-9, -40), -40);
});

test('columns map monotonically across the range and clamp outside it', () => {
  assert.equal(columnOf(MIN_FREQUENCY, 100), 0);
  assert.equal(columnOf(MAX_FREQUENCY, 100), 99);
  assert.equal(columnOf(1, 100), 0);
  assert.ok(columnOf(500, 100) < columnOf(600, 100));
});

test('every resonance shows as a near-0 dB peak in a coarse spectrum', () => {
  const columns = 120;
  const spectrum = sampleSpectrum(modes, columns, { perColumn: 1 });
  assert.equal(spectrum.length, columns);
  for (const mode of modes) {
    assert.ok(spectrum[columnOf(mode.freq, columns)] > -1, mode.id);
  }
  // Below the first resonance the plate answers weakly.
  assert.ok(spectrum[0] < -10);
});

test('clicks snap to a nearby resonance and pass through elsewhere', () => {
  const columns = 600;
  const mode = modes.find((m) => m.id === '2,5+');
  const exact = columnOf(mode.freq, columns) + 0.5;
  assert.equal(frequencyAtColumn(modes, exact + 2, columns), mode.freq);
  // Far below the lowest mode nothing is near enough to snap to.
  const free = frequencyAtColumn(modes, 5, columns);
  assert.ok(free < modes[0].freq);
  assert.ok(Math.abs(free - MIN_FREQUENCY * Math.pow(MAX_FREQUENCY / MIN_FREQUENCY, 5 / columns)) < 1e-9);
});
