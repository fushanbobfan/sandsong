// The plate's response across the whole frequency range, for the spectrum
// strip under the frequency slider.

import {
  resonance, frequencyToSlider, sliderToFrequency, DEFAULT_Q, MIN_FREQUENCY, MAX_FREQUENCY,
} from './plate.js';

// Overall response to a drive frequency: the root sum of squares of every
// mode's weight, so a clean resonance scores 1.
export function responseAt(modes, drive, q = DEFAULT_Q) {
  let sum = 0;
  for (const mode of modes) {
    const w = resonance(drive, mode.freq, q) / q;
    sum += w * w;
  }
  return Math.sqrt(sum);
}

export function toDecibels(value, floor = -60) {
  if (value <= 0) return floor;
  return Math.max(floor, 20 * Math.log10(value));
}

// Response in dB for `columns` equal slices of the log-frequency axis. Each
// column keeps the loudest of several samples, and every resonance is also
// written into its own column, so peaks narrower than a column still show.
export function sampleSpectrum(modes, columns, options = {}) {
  const q = options.q ?? DEFAULT_Q;
  const lo = options.lo ?? MIN_FREQUENCY;
  const hi = options.hi ?? MAX_FREQUENCY;
  const perColumn = options.perColumn ?? 4;
  const floor = options.floor ?? -60;
  const out = new Float32Array(columns).fill(floor);
  for (let c = 0; c < columns; c++) {
    for (let s = 0; s < perColumn; s++) {
      const f = sliderToFrequency((c + (s + 0.5) / perColumn) / columns, lo, hi);
      out[c] = Math.max(out[c], toDecibels(responseAt(modes, f, q), floor));
    }
  }
  for (const mode of modes) {
    if (mode.freq < lo || mode.freq > hi) continue;
    const c = columnOf(mode.freq, columns, lo, hi);
    out[c] = Math.max(out[c], toDecibels(responseAt(modes, mode.freq, q), floor));
  }
  return out;
}

export function columnOf(freq, columns, lo = MIN_FREQUENCY, hi = MAX_FREQUENCY) {
  return Math.min(columns - 1, Math.max(0, Math.floor(frequencyToSlider(freq, lo, hi) * columns)));
}

// The frequency under a point on the strip, snapped to a resonance when one
// lies within `snap` columns so small peaks are easy to hit.
export function frequencyAtColumn(modes, position, columns, snap = 3, lo = MIN_FREQUENCY, hi = MAX_FREQUENCY) {
  const f = sliderToFrequency(position / columns, lo, hi);
  let best = null;
  let bestGap = Infinity;
  for (const mode of modes) {
    const gap = Math.abs(frequencyToSlider(mode.freq, lo, hi) * columns - position);
    if (gap < bestGap) {
      bestGap = gap;
      best = mode;
    }
  }
  return best && bestGap <= snap ? best.freq : f;
}
