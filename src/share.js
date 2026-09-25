// Share links: the drive frequency, palette and edge rule packed into the
// URL hash, e.g. #f=510.0&p=brass&e=bounce.

import { MIN_FREQUENCY, MAX_FREQUENCY, clamp } from './plate.js';
import { PALETTES } from './render.js';

const EDGES = ['bounce', 'spill'];

export function encodeState({ freq, palette, edges }) {
  const params = new URLSearchParams();
  params.set('f', freq.toFixed(1));
  params.set('p', palette);
  params.set('e', edges);
  return params.toString();
}

// Returns only the fields that were present and valid.
export function decodeState(hash) {
  const params = new URLSearchParams(String(hash).replace(/^#/, ''));
  const state = {};
  const f = Number(params.get('f'));
  if (params.has('f') && Number.isFinite(f) && f > 0) {
    state.freq = clamp(f, MIN_FREQUENCY, MAX_FREQUENCY);
  }
  const p = params.get('p');
  if (PALETTES.some((pal) => pal.id === p)) state.palette = p;
  const e = params.get('e');
  if (EDGES.includes(e)) state.edges = e;
  return state;
}
