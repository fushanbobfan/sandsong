import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeState, decodeState } from '../src/share.js';
import { MIN_FREQUENCY, MAX_FREQUENCY } from '../src/plate.js';

test('state round-trips through the hash', () => {
  const state = { freq: 510.4, palette: 'slate', edges: 'spill' };
  const hash = encodeState(state);
  assert.equal(hash, 'f=510.4&p=slate&e=spill');
  assert.deepEqual(decodeState(`#${hash}`), state);
});

test('malformed or unknown fields are dropped', () => {
  assert.deepEqual(decodeState(''), {});
  assert.deepEqual(decodeState('#f=abc&p=neon&e=wrap'), {});
  assert.deepEqual(decodeState('#f=-5'), {});
  assert.deepEqual(decodeState('#e=bounce&junk=1'), { edges: 'bounce' });
});

test('frequencies are clamped to the playable range', () => {
  assert.equal(decodeState('#f=1').freq, MIN_FREQUENCY);
  assert.equal(decodeState('#f=99999').freq, MAX_FREQUENCY);
});
