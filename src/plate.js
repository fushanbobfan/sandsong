// Vibration model for a square plate with free edges.
//
// Plate coordinates run from -1 to 1 on both axes. Each standing-wave mode is
// labelled by two whole numbers n <= m and a sign s, and has the shape
//
//   z(x, y) = cos(n π u) cos(m π v) + s · cos(m π u) cos(n π v)
//
// with u = (x + 1) / 2 and v = (y + 1) / 2. This is the classic
// approximation Chladni's figures are usually drawn from.
//
// Natural frequencies grow roughly with n² + m², as bending waves in a thin
// plate do. Taken literally that formula gives many exact ties, such as
// (0,5) and (3,4), and in an ideal plate each "+" mode also ties with its "−"
// partner. Real plates split all of these, so the frequency carries small
// correction terms and the "−" partner sits a few percent higher. The
// coefficients were chosen so that no two modes up to order 6 lie closer than
// about 2 % apart, which keeps every resonance individually reachable.

export const BASE_FREQUENCY = 60;
export const LINEAR = 0.38;
export const CROSS = 0.38;
export const SPLIT = 0.04;
export const MAX_ORDER = 6;
export const MIN_FREQUENCY = 60;
export const MAX_FREQUENCY = 6000;
export const DEFAULT_Q = 120;

export function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

export function modeId(mode) {
  if (mode.n === mode.m) return `${mode.n},${mode.m}`;
  return `${mode.n},${mode.m}${mode.s > 0 ? '+' : '−'}`;
}

export function naturalFrequency(n, m, s, base = BASE_FREQUENCY) {
  const shape = n * n + m * m + LINEAR * (n + m) + CROSS * n * m;
  return base * shape * (s < 0 ? 1 + SPLIT : 1);
}

// Every mode up to maxOrder, sorted by natural frequency.
export function modeList(maxOrder = MAX_ORDER, base = BASE_FREQUENCY) {
  const modes = [];
  for (let n = 0; n <= maxOrder; n++) {
    for (let m = n; m <= maxOrder; m++) {
      if (n === 0 && m === 0) continue;
      const signs = n === m ? [1] : [1, -1];
      for (const s of signs) {
        modes.push({ n, m, s, freq: naturalFrequency(n, m, s, base) });
      }
    }
  }
  modes.sort((a, b) => a.freq - b.freq || a.n - b.n || b.s - a.s);
  for (const mode of modes) mode.id = modeId(mode);
  return modes;
}

export function modeShape(mode, x, y) {
  const u = (x + 1) / 2;
  const v = (y + 1) / 2;
  const a = Math.cos(mode.n * Math.PI * u) * Math.cos(mode.m * Math.PI * v);
  const b = Math.cos(mode.m * Math.PI * u) * Math.cos(mode.n * Math.PI * v);
  return a + mode.s * b;
}

// Steady-state amplitude of a driven, damped oscillator relative to its
// response at zero frequency. At resonance it equals the quality factor q.
export function resonance(drive, natural, q) {
  const r = drive / natural;
  const a = 1 - r * r;
  const b = r / q;
  return 1 / Math.sqrt(a * a + b * b);
}

// How strongly each mode answers a drive frequency, scaled so a mode hit
// exactly on resonance has weight 1. Modes below the cutoff are dropped.
export function modeWeights(modes, drive, q = DEFAULT_Q, cutoff = 0.01) {
  const weights = [];
  for (const mode of modes) {
    const w = resonance(drive, mode.freq, q) / q;
    if (w >= cutoff) weights.push({ mode, weight: w });
  }
  weights.sort((a, b) => b.weight - a.weight);
  return weights;
}

// Sample the plate displacement on a size × size grid of cell centres.
// Values are the signed displacement; the magnitude is what shakes the sand.
export function sampleField(weights, size) {
  const field = new Float32Array(size * size);
  const cols = [];
  for (const { mode, weight } of weights) {
    // cos(k π u) for every column and row, per wavenumber used by this mode.
    const cn = new Float32Array(size);
    const cm = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const u = (i + 0.5) / size;
      cn[i] = Math.cos(mode.n * Math.PI * u);
      cm[i] = Math.cos(mode.m * Math.PI * u);
    }
    cols.push({ cn, cm, s: mode.s, weight });
  }
  for (let j = 0; j < size; j++) {
    const row = j * size;
    for (const { cn, cm, s, weight } of cols) {
      const cmj = cm[j];
      const cnj = cn[j];
      for (let i = 0; i < size; i++) {
        field[row + i] += weight * (cn[i] * cmj + s * cm[i] * cnj);
      }
    }
  }
  return field;
}

export function fieldPeak(field) {
  let peak = 0;
  for (let k = 0; k < field.length; k++) {
    const a = Math.abs(field[k]);
    if (a > peak) peak = a;
  }
  return peak;
}

// Bilinear lookup of |field| at a plate position.
export function amplitudeAt(field, size, x, y) {
  const fx = clamp(((x + 1) / 2) * size - 0.5, 0, size - 1);
  const fy = clamp(((y + 1) / 2) * size - 0.5, 0, size - 1);
  const i0 = Math.floor(fx);
  const j0 = Math.floor(fy);
  const i1 = Math.min(i0 + 1, size - 1);
  const j1 = Math.min(j0 + 1, size - 1);
  const tx = fx - i0;
  const ty = fy - j0;
  const a = Math.abs(field[j0 * size + i0]);
  const b = Math.abs(field[j0 * size + i1]);
  const c = Math.abs(field[j1 * size + i0]);
  const d = Math.abs(field[j1 * size + i1]);
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

// Nearest natural frequency above or below a drive frequency.
export function nextResonance(modes, drive, direction) {
  const eps = drive * 1e-6;
  if (direction > 0) {
    for (const mode of modes) if (mode.freq > drive + eps) return mode;
    return null;
  }
  for (let k = modes.length - 1; k >= 0; k--) {
    if (modes[k].freq < drive - eps) return modes[k];
  }
  return null;
}

export function nearestMode(modes, drive) {
  let best = null;
  let bestGap = Infinity;
  for (const mode of modes) {
    const gap = Math.abs(Math.log(mode.freq / drive));
    if (gap < bestGap) {
      bestGap = gap;
      best = mode;
    }
  }
  return best;
}

// Log-scale mapping between a 0..1 slider position and a frequency.
export function sliderToFrequency(t, lo = MIN_FREQUENCY, hi = MAX_FREQUENCY) {
  return lo * Math.pow(hi / lo, clamp(t, 0, 1));
}

export function frequencyToSlider(f, lo = MIN_FREQUENCY, hi = MAX_FREQUENCY) {
  return clamp(Math.log(f / lo) / Math.log(hi / lo), 0, 1);
}
