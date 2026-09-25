import {
  modeList, modeWeights, sampleField, fieldPeak, nextResonance, nearestMode,
  sliderToFrequency, frequencyToSlider, clamp, MIN_FREQUENCY, MAX_FREQUENCY,
} from './plate.js';
import {
  makeRng, createSand, pour, sprinkleAt, stepSand, nodalShare, DEFAULTS,
} from './sand.js';
import { PALETTES, paletteById, paintPlate, paintSand, toPlate, formatFrequency } from './render.js';
import { Tone } from './tone.js';
import { encodeState, decodeState } from './share.js';
import { sampleSpectrum, columnOf, frequencyAtColumn } from './spectrum.js';
import { createSweep, stepSweep } from './sweep.js';
import { nodalMask, paintMask, atlasRows } from './atlas.js';

const FIELD_SIZE = 128;
const CAPACITY = 60000;
const START_MODE = '2,5+';
// Below this share of a clean resonance's motion the plate counts as still.
const QUIET = 0.05;

const $ = (id) => document.getElementById(id);
const canvas = $('plate');
const ctx = canvas.getContext('2d');
const width = canvas.width;
const image = ctx.createImageData(width, width);

const modes = modeList();
const rng = makeRng((Date.now() ^ 0x5eed) >>> 0);
const sand = createSand(CAPACITY);
const tone = new Tone();

const state = {
  freq: modes.find((m) => m.id === START_MODE).freq,
  palette: PALETTES[0].id,
  edges: 'bounce',
  grains: 20000,
  shake: 1,
  speed: 2,
  tint: false,
  paused: false,
};

let field = null;
let peak = 0;
let weights = [];
let frame = 0;
let sweep = null;
let lastTime = null;
let spectrum = null;
const atlasItems = new Map();

Object.assign(state, decodeState(location.hash));

function modeLabel(mode) {
  return `(${mode.id}) · ${formatFrequency(mode.freq)}`;
}

function rebuildField() {
  weights = modeWeights(modes, state.freq);
  field = sampleField(weights, FIELD_SIZE);
  peak = fieldPeak(field);
}

function setFrequency(f, { fromSlider = false, fromSweep = false } = {}) {
  if (!fromSweep) stopSweep();
  state.freq = clamp(f, MIN_FREQUENCY, MAX_FREQUENCY);
  if (!fromSlider) $('freq').value = frequencyToSlider(state.freq);
  $('freq-value').textContent = formatFrequency(state.freq);
  tone.setFrequency(state.freq);
  rebuildField();
  updateModeReadout();
  drawSpectrum();
}

function updateModeReadout() {
  const near = nearestMode(modes, state.freq);
  const top = weights[0];
  const onMode = near && Math.abs(near.freq / state.freq - 1) < 1e-6;
  $('mode').value = onMode ? near.id : '';
  const nearest = `Nearest resonance (${near.id}) at ${formatFrequency(near.freq)}.`;
  // A single mode on resonance peaks at about 2, so peak / 2 is the plate's
  // motion as a share of a clean resonance.
  const strength = peak / 2;
  highlightAtlas(strength >= QUIET && top.weight >= 0.5 ? top.mode.id : null);
  if (strength < QUIET) {
    $('mode-readout').textContent = `Between resonances: the plate is nearly still. ${nearest}`;
    return;
  }
  if (top.weight < 0.5) {
    $('mode-readout').textContent = `Between resonances: a weak blend of modes at ${Math.round(strength * 100)}% strength. ${nearest}`;
    return;
  }
  const percent = Math.round(top.weight * 100);
  const second = weights[1];
  const mix = second && second.weight > 0.3 * top.weight ? `, mixed with (${second.mode.id})` : '';
  $('mode-readout').textContent = `Mode (${top.mode.id}) at ${percent}% of full response${mix}.`;
}

function pourSand() {
  pour(sand, state.grains, rng);
}

function render() {
  const palette = paletteById(state.palette);
  paintPlate(image.data, width, palette, state.tint ? { field, size: FIELD_SIZE, peak: Math.max(peak, 1) } : null);
  paintSand(image.data, width, sand, palette);
  ctx.putImageData(image, 0, 0);
}

function updateStatus() {
  const nodal = nodalShare(sand, field, FIELD_SIZE, peak, 0.15, 2 * QUIET);
  const grains = `${sand.count.toLocaleString()} grains`;
  $('status').textContent = nodal === null
    ? `${grains} · plate quiet`
    : `${grains} · ${Math.round(nodal * 100)}% resting on nodal lines`;
}

function tick(now) {
  const dt = lastTime === null ? 0 : Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  if (sweep && !state.paused) {
    const step = stepSweep(sweep, state.freq, dt, modes);
    if (step.freq !== state.freq) setFrequency(step.freq, { fromSweep: true });
    if (step.stopped) stopSweep();
  }
  if (!state.paused) {
    const options = { kick: DEFAULTS.kick * state.shake, edges: state.edges };
    for (let s = 0; s < state.speed; s++) stepSand(sand, field, FIELD_SIZE, rng, options);
  }
  render();
  if (frame++ % 15 === 0) updateStatus();
  requestAnimationFrame(tick);
}

// Mode atlas.
const ATLAS_SIZE = 56;

function buildAtlas() {
  const container = $('atlas-rows');
  for (const row of atlasRows(modes)) {
    const line = document.createElement('div');
    line.className = 'atlas-row';
    const label = document.createElement('span');
    label.className = 'atlas-order';
    label.textContent = `n + m = ${row.order}`;
    const list = document.createElement('ul');
    list.className = 'atlas-list';
    for (const mode of row.modes) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'atlas-item';
      button.setAttribute('aria-label', `Mode (${mode.id}) at ${formatFrequency(mode.freq)}`);
      const thumb = document.createElement('canvas');
      thumb.width = ATLAS_SIZE;
      thumb.height = ATLAS_SIZE;
      thumb.setAttribute('aria-hidden', 'true');
      const caption = document.createElement('span');
      caption.textContent = mode.id;
      button.append(thumb, caption);
      button.addEventListener('click', () => setFrequency(mode.freq));
      item.append(button);
      list.append(item);
      atlasItems.set(mode.id, { button, thumb, mask: nodalMask(mode, ATLAS_SIZE) });
    }
    line.append(label, list);
    container.append(line);
  }
  paintAtlas();
}

function paintAtlas() {
  const palette = paletteById(state.palette);
  for (const { thumb, mask } of atlasItems.values()) {
    const tctx = thumb.getContext('2d');
    const img = tctx.createImageData(ATLAS_SIZE, ATLAS_SIZE);
    paintMask(img.data, mask, palette.sand, palette.plate);
    tctx.putImageData(img, 0, 0);
  }
}

function highlightAtlas(id) {
  for (const [key, { button }] of atlasItems) {
    if (key === id) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  }
}

// Spectrum strip.
const spectrumCanvas = $('spectrum');
const spectrumCtx = spectrumCanvas.getContext('2d');
const SPECTRUM_FLOOR = -40;

function drawSpectrum() {
  const w = spectrumCanvas.width;
  const h = spectrumCanvas.height;
  if (!spectrum || spectrum.length !== w) {
    spectrum = sampleSpectrum(modes, w, { floor: SPECTRUM_FLOOR });
  }
  spectrumCtx.clearRect(0, 0, w, h);
  spectrumCtx.fillStyle = 'rgb(227 173 98 / 0.55)';
  // Bars show linear amplitude: on a dB scale the shallow valleys between
  // closely packed high modes would fill the strip.
  for (let c = 0; c < w; c++) {
    const level = Math.min(1, Math.pow(10, spectrum[c] / 20));
    const bar = Math.max(1, level * (h - 4));
    spectrumCtx.fillRect(c, h - bar, 1, bar);
  }
  const x = columnOf(state.freq, w) + 0.5;
  spectrumCtx.fillStyle = '#8fd3ff';
  spectrumCtx.fillRect(x - 1, 0, 2, h);
}

function fitSpectrum() {
  const rect = spectrumCanvas.getBoundingClientRect();
  const w = Math.max(100, Math.round(rect.width * (window.devicePixelRatio || 1)));
  const h = Math.max(40, Math.round(rect.height * (window.devicePixelRatio || 1)));
  if (w !== spectrumCanvas.width || h !== spectrumCanvas.height) {
    spectrumCanvas.width = w;
    spectrumCanvas.height = h;
    drawSpectrum();
  }
}

function tuneFromSpectrum(event) {
  const rect = spectrumCanvas.getBoundingClientRect();
  const position = ((event.clientX - rect.left) / rect.width) * spectrumCanvas.width;
  const snap = 6 * (window.devicePixelRatio || 1);
  setFrequency(frequencyAtColumn(modes, position, spectrumCanvas.width, snap));
}

spectrumCanvas.addEventListener('pointerdown', (event) => {
  spectrumCanvas.setPointerCapture(event.pointerId);
  tuneFromSpectrum(event);
});
spectrumCanvas.addEventListener('pointermove', (event) => {
  if (spectrumCanvas.hasPointerCapture(event.pointerId)) tuneFromSpectrum(event);
});
window.addEventListener('resize', fitSpectrum);

// Sweep.
function startSweep(direction) {
  if (sweep && sweep.direction === direction) {
    stopSweep();
    return;
  }
  stopSweep();
  sweep = createSweep({
    direction,
    rate: Number($('sweep-rate').value),
    hold: Number($('sweep-hold').value),
  });
  const button = direction > 0 ? $('sweep-up') : $('sweep-down');
  button.textContent = 'Stop sweep';
  button.setAttribute('aria-pressed', 'true');
}

function stopSweep() {
  sweep = null;
  $('sweep-up').textContent = 'Sweep up ▶';
  $('sweep-down').textContent = '◀ Sweep down';
  $('sweep-up').setAttribute('aria-pressed', 'false');
  $('sweep-down').setAttribute('aria-pressed', 'false');
}

$('sweep-up').addEventListener('click', () => startSweep(1));
$('sweep-down').addEventListener('click', () => startSweep(-1));
$('sweep-rate').addEventListener('change', (e) => {
  if (sweep) sweep.rate = Number(e.target.value);
});
$('sweep-hold').addEventListener('change', (e) => {
  if (!sweep) return;
  sweep.hold = Number(e.target.value);
  sweep.holdLeft = Math.min(sweep.holdLeft, sweep.hold);
});

function jump(direction) {
  const mode = nextResonance(modes, state.freq, direction);
  if (mode) setFrequency(mode.freq);
}

function setPaused(paused) {
  state.paused = paused;
  $('pause').textContent = paused ? 'Resume' : 'Pause';
}

function toggleTone() {
  const on = tone.toggle();
  $('tone').setAttribute('aria-pressed', String(on));
  $('tone').textContent = on ? 'Stop tone' : 'Play tone';
}

function shareHash() {
  return encodeState({ freq: state.freq, palette: state.palette, edges: state.edges });
}

function flash(button, text) {
  const original = button.dataset.label ?? button.textContent;
  button.dataset.label = original;
  button.textContent = text;
  clearTimeout(button._timer);
  button._timer = setTimeout(() => {
    button.textContent = original;
  }, 1400);
}

// Mode picker.
const modeSelect = $('mode');
modeSelect.append(new Option('Choose a resonance…', ''));
for (const mode of modes) modeSelect.append(new Option(modeLabel(mode), mode.id));
modeSelect.addEventListener('change', () => {
  const mode = modes.find((m) => m.id === modeSelect.value);
  if (mode) setFrequency(mode.freq);
});

for (const p of PALETTES) $('palette').append(new Option(p.name, p.id));
$('palette').value = state.palette;
$('palette').addEventListener('change', (e) => {
  state.palette = e.target.value;
  paintAtlas();
});

$('edges').value = state.edges;
$('edges').addEventListener('change', (e) => {
  state.edges = e.target.value;
  if (state.edges === 'bounce' && sand.count < state.grains / 4) pourSand();
});

$('freq').addEventListener('input', (e) => {
  setFrequency(sliderToFrequency(Number(e.target.value)), { fromSlider: true });
});
$('prev-res').addEventListener('click', () => jump(-1));
$('next-res').addEventListener('click', () => jump(1));

$('tone').addEventListener('click', toggleTone);
$('volume').addEventListener('input', (e) => tone.setVolume(Number(e.target.value)));
tone.setVolume(Number($('volume').value));

$('grains').addEventListener('input', (e) => {
  state.grains = Number(e.target.value);
  $('grains-value').textContent = state.grains.toLocaleString();
});
$('grains').addEventListener('change', pourSand);
$('grains-value').textContent = state.grains.toLocaleString();

$('shake').addEventListener('input', (e) => {
  state.shake = Number(e.target.value);
  $('shake-value').textContent = `${state.shake.toFixed(1)}×`;
});

$('speed').addEventListener('input', (e) => {
  state.speed = Number(e.target.value);
  $('speed-value').textContent = `${state.speed}×`;
});

$('tint').checked = state.tint;
$('tint').addEventListener('change', (e) => {
  state.tint = e.target.checked;
});

$('pause').addEventListener('click', () => setPaused(!state.paused));
$('pour').addEventListener('click', pourSand);

$('save-png').addEventListener('click', () => {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sandsong-${Math.round(state.freq)}hz.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
});

$('copy-link').addEventListener('click', async () => {
  history.replaceState(null, '', `#${shareHash()}`);
  try {
    await navigator.clipboard.writeText(location.href);
    flash($('copy-link'), 'Link copied');
  } catch {
    flash($('copy-link'), 'Link is in the address bar');
  }
});

// Sprinkle sand by dragging on the plate.
function platePoint(event) {
  const rect = canvas.getBoundingClientRect();
  const px = ((event.clientX - rect.left) / rect.width) * width;
  const py = ((event.clientY - rect.top) / rect.height) * width;
  return [toPlate(px, width), toPlate(py, width)];
}

canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture(event.pointerId);
  const [x, y] = platePoint(event);
  sprinkleAt(sand, x, y, 0.06, 300, rng);
});
canvas.addEventListener('pointermove', (event) => {
  if (!canvas.hasPointerCapture(event.pointerId)) return;
  const [x, y] = platePoint(event);
  sprinkleAt(sand, x, y, 0.06, 120, rng);
});

document.addEventListener('keydown', (event) => {
  if (event.target.closest('input, select, textarea') && event.key !== ' ') return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  switch (event.key) {
    case 'ArrowLeft':
      setFrequency(state.freq / 1.002);
      break;
    case 'ArrowRight':
      setFrequency(state.freq * 1.002);
      break;
    case '[':
      jump(-1);
      break;
    case ']':
      jump(1);
      break;
    case ' ':
      if (event.target.closest('button, input, select')) return;
      setPaused(!state.paused);
      break;
    case 'p':
    case 'P':
      pourSand();
      break;
    case 't':
    case 'T':
      toggleTone();
      break;
    case 's':
    case 'S':
      if (sweep) stopSweep();
      else startSweep(1);
      break;
    default:
      return;
  }
  event.preventDefault();
});

buildAtlas();
fitSpectrum();
setFrequency(state.freq);
pourSand();
requestAnimationFrame(tick);
