// Automatic frequency sweep. The drive glides up or down at a steady rate in
// octaves per second and, when hold is set, stops on each resonance it meets
// for that many seconds so the sand has time to draw the figure.

import { nextResonance, MIN_FREQUENCY, MAX_FREQUENCY } from './plate.js';

export function createSweep({ rate = 0.08, hold = 4, direction = 1 } = {}) {
  return { rate, hold, direction: direction < 0 ? -1 : 1, holdLeft: 0, active: true };
}

// Advance the sweep by dt seconds from `freq`. Returns the new frequency, the
// mode it just arrived on (if any) and whether the sweep has reached the end
// of the range and stopped.
export function stepSweep(sweep, freq, dt, modes, lo = MIN_FREQUENCY, hi = MAX_FREQUENCY) {
  if (!sweep.active) return { freq, arrived: null, stopped: true };
  if (sweep.holdLeft > 0) {
    sweep.holdLeft = Math.max(0, sweep.holdLeft - dt);
    return { freq, arrived: null, stopped: false };
  }
  let next = freq * Math.pow(2, sweep.direction * sweep.rate * dt);
  let arrived = null;
  if (sweep.hold > 0) {
    const target = nextResonance(modes, freq, sweep.direction);
    const crossed = target && (sweep.direction > 0 ? next >= target.freq : next <= target.freq);
    if (crossed) {
      next = target.freq;
      arrived = target;
      sweep.holdLeft = sweep.hold;
    }
  }
  if (next >= hi || next <= lo) {
    sweep.active = false;
    return { freq: Math.min(hi, Math.max(lo, next)), arrived, stopped: true };
  }
  return { freq: next, arrived, stopped: false };
}
