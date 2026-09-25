// The drive tone, played through Web Audio so you can hear the frequency
// that shapes the sand. The audio context is only created on the first
// start(), from a user gesture, as browsers require.

const GLIDE = 0.03;

export class Tone {
  constructor(createContext = () => new AudioContext()) {
    this.createContext = createContext;
    this.ctx = null;
    this.osc = null;
    this.gain = null;
    this.frequency = 440;
    this.volume = 0.15;
    this.on = false;
  }

  start() {
    if (!this.ctx) {
      this.ctx = this.createContext();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (!this.osc) {
      this.osc = this.ctx.createOscillator();
      this.osc.type = 'sine';
      this.osc.frequency.value = this.frequency;
      this.osc.connect(this.gain);
      this.osc.start();
    }
    this.gain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, GLIDE);
    this.on = true;
  }

  stop() {
    if (!this.on) return;
    this.on = false;
    const osc = this.osc;
    this.osc = null;
    const t = this.ctx.currentTime;
    this.gain.gain.setTargetAtTime(0, t, GLIDE);
    osc.stop(t + GLIDE * 6);
  }

  toggle() {
    if (this.on) this.stop();
    else this.start();
    return this.on;
  }

  setFrequency(f) {
    this.frequency = f;
    if (this.osc) this.osc.frequency.setTargetAtTime(f, this.ctx.currentTime, GLIDE);
  }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.on) this.gain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, GLIDE);
  }
}
