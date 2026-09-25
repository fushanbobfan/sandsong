import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSweep, stepSweep } from '../src/sweep.js';
import { modeList, MAX_FREQUENCY, MIN_FREQUENCY } from '../src/plate.js';

const modes = modeList();

test('without holds the sweep glides at the set rate in octaves per second', () => {
  const sweep = createSweep({ rate: 0.5, hold: 0 });
  const { freq, arrived } = stepSweep(sweep, 1000, 2, modes);
  assert.ok(Math.abs(freq - 2000) < 1e-9);
  assert.equal(arrived, null);
  const down = createSweep({ rate: 1, hold: 0, direction: -1 });
  assert.ok(Math.abs(stepSweep(down, 1000, 1, modes).freq - 500) < 1e-9);
});

test('with holds the sweep lands exactly on the next resonance and waits there', () => {
  const sweep = createSweep({ rate: 1, hold: 3 });
  const start = modes[3].freq * 1.001;
  const step = stepSweep(sweep, start, 1, modes);
  assert.equal(step.arrived, modes[4]);
  assert.equal(step.freq, modes[4].freq);
  // Holding: frequency stays put until the hold runs out.
  assert.equal(stepSweep(sweep, step.freq, 1, modes).freq, modes[4].freq);
  assert.equal(stepSweep(sweep, step.freq, 1.5, modes).freq, modes[4].freq);
  assert.equal(stepSweep(sweep, step.freq, 0.5, modes).freq, modes[4].freq);
  // Then it moves on without re-arriving on the same mode.
  const after = stepSweep(sweep, step.freq, 0.001, modes);
  assert.ok(after.freq > modes[4].freq);
  assert.equal(after.arrived, null);
});

test('sweeping down visits resonances in descending order', () => {
  const sweep = createSweep({ rate: 2, hold: 0.01, direction: -1 });
  let freq = modes[10].freq * 1.001;
  const seen = [];
  for (let k = 0; k < 2000 && seen.length < 5; k++) {
    const step = stepSweep(sweep, freq, 0.02, modes);
    freq = step.freq;
    if (step.arrived) seen.push(step.arrived);
  }
  assert.deepEqual(seen, [modes[10], modes[9], modes[8], modes[7], modes[6]]);
});

test('the sweep stops at the ends of the range and stays stopped', () => {
  const up = createSweep({ rate: 4, hold: 0 });
  const end = stepSweep(up, MAX_FREQUENCY * 0.9, 1, modes);
  assert.equal(end.stopped, true);
  assert.equal(end.freq, MAX_FREQUENCY);
  assert.equal(up.active, false);
  assert.equal(stepSweep(up, 1000, 1, modes).freq, 1000);
  const down = createSweep({ rate: 4, hold: 0, direction: -1 });
  assert.equal(stepSweep(down, MIN_FREQUENCY * 1.1, 1, modes).freq, MIN_FREQUENCY);
});
