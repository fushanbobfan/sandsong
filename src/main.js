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

const FIELD_SIZE = 128;
const CAPACITY = 60000;
const START_MODE = '2,5+';

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

Object.assign(state, decodeState(location.hash));

function modeLabel(mode) {
  return `(${mode.id}) · ${formatFrequency(mode.freq)}`;
}

function rebuildField() {
  weights = modeWeights(modes, state.freq);
  field = sampleField(weights, FIELD_SIZE);
  peak = fieldPeak(field);
}

function setFrequency(f, { fromSlider = false } = {}) {
  state.freq = clamp(f, MIN_FREQUENCY, MAX_FREQUENCY);
  if (!fromSlider) $('freq').value = frequencyToSlider(state.freq);
  $('freq-value').textContent = formatFrequency(state.freq);
  tone.setFrequency(state.freq);
  rebuildField();
  updateModeReadout();
}

function updateModeReadout() {
  const near = nearestMode(modes, state.freq);
  const top = weights[0];
  const onMode = near && Math.abs(near.freq / state.freq - 1) < 1e-6;
  $('mode').value = onMode ? near.id : '';
  if (!top || top.weight < 0.05) {
    $('mode-readout').textContent = `Between resonances: the plate is nearly still. Nearest mode (${near.id}) at ${formatFrequency(near.freq)}.`;
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
  const nodal = nodalShare(sand, field, FIELD_SIZE, peak);
  const grains = `${sand.count.toLocaleString()} grains`;
  $('status').textContent = nodal === null
    ? `${grains} · plate quiet`
    : `${grains} · ${Math.round(nodal * 100)}% resting on nodal lines`;
}

function tick() {
  if (!state.paused) {
    const options = { kick: DEFAULTS.kick * state.shake, edges: state.edges };
    for (let s = 0; s < state.speed; s++) stepSand(sand, field, FIELD_SIZE, rng, options);
  }
  render();
  if (frame++ % 15 === 0) updateStatus();
  requestAnimationFrame(tick);
}

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
    default:
      return;
  }
  event.preventDefault();
});

setFrequency(state.freq);
pourSand();
requestAnimationFrame(tick);
