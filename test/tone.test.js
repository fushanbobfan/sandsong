import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tone } from '../src/tone.js';

function param(value = 0) {
  return {
    value,
    targets: [],
    setTargetAtTime(v) {
      this.targets.push(v);
    },
  };
}

function fakeContext() {
  const ctx = {
    state: 'suspended',
    currentTime: 1,
    destination: {},
    oscillators: [],
    resumed: 0,
    resume() {
      this.resumed++;
      this.state = 'running';
    },
    createGain() {
      return { gain: param(1), connect() {} };
    },
    createOscillator() {
      const osc = {
        type: '',
        frequency: param(),
        started: false,
        stoppedAt: null,
        connect() {},
        start() {
          this.started = true;
        },
        stop(t) {
          this.stoppedAt = t;
        },
      };
      ctx.oscillators.push(osc);
      return osc;
    },
  };
  return ctx;
}

test('no audio context exists until the tone is first started', () => {
  let made = 0;
  const tone = new Tone(() => {
    made++;
    return fakeContext();
  });
  tone.setFrequency(300);
  tone.setVolume(0.5);
  assert.equal(made, 0);
  tone.start();
  assert.equal(made, 1);
  assert.equal(tone.ctx.resumed, 1);
  assert.equal(tone.ctx.oscillators[0].frequency.value, 300);
  assert.deepEqual(tone.gain.gain.targets, [0.5]);
});

test('toggling stops the oscillator and a new start makes a fresh one', () => {
  const tone = new Tone(fakeContext);
  assert.equal(tone.toggle(), true);
  const first = tone.ctx.oscillators[0];
  assert.equal(tone.toggle(), false);
  assert.ok(first.stoppedAt > tone.ctx.currentTime);
  assert.equal(tone.gain.gain.targets.at(-1), 0);
  tone.toggle();
  assert.equal(tone.ctx.oscillators.length, 2);
  assert.ok(tone.ctx.oscillators[1].started);
});

test('frequency glides while playing and volume is clamped', () => {
  const tone = new Tone(fakeContext);
  tone.start();
  tone.setFrequency(1234);
  assert.deepEqual(tone.osc.frequency.targets, [1234]);
  tone.setVolume(4);
  assert.equal(tone.volume, 1);
  tone.setVolume(-1);
  assert.equal(tone.volume, 0);
  tone.stop();
  tone.stop();
  assert.equal(tone.on, false);
});
