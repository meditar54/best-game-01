// audio.js — every sound in NOVA DRIFT is synthesized live with WebAudio.
// No audio files are shipped; the music is a small step sequencer over two
// oscillators (a bass line and a pad), and each effect is one short synth voice.

/** A tiny synth voice: one oscillator swept in frequency with an envelope. */
function blip(ctx, dest, { type = 'square', from = 440, to = 220, dur = 0.12, vol = 0.2, delay = 0 }) {
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** A filtered noise burst, used for explosions. */
function noiseBurst(ctx, dest, { dur = 0.3, vol = 0.3, freq = 800, delay = 0 }) {
  const t0 = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(freq, t0);
  filter.frequency.exponentialRampToValueAtTime(80, t0 + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  src.start(t0);
}

const BASS_LINE = [55, 0, 55, 0, 65.41, 0, 49, 0, 55, 0, 55, 0, 73.42, 65.41, 49, 0];
const PAD_CHORDS = [
  [220, 277.18, 329.63],
  [174.61, 220, 261.63],
  [196, 246.94, 293.66],
  [164.81, 220, 261.63],
];

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.musicTimer = null;
    this.step = 0;
  }

  /** Create the AudioContext. Call from a user gesture (click / key press). */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setValueAtTime(muted ? 0 : 0.5, this.ctx.currentTime);
    }
  }

  shoot() {
    if (!this.ctx || this.muted) return;
    blip(this.ctx, this.master, { type: 'square', from: 920, to: 240, dur: 0.09, vol: 0.1 });
  }

  enemyShoot() {
    if (!this.ctx || this.muted) return;
    blip(this.ctx, this.master, { type: 'sawtooth', from: 300, to: 140, dur: 0.14, vol: 0.07 });
  }

  explosion(big = false) {
    if (!this.ctx || this.muted) return;
    noiseBurst(this.ctx, this.master, { dur: big ? 0.55 : 0.28, vol: big ? 0.4 : 0.22, freq: big ? 1400 : 900 });
    blip(this.ctx, this.master, { type: 'sine', from: 160, to: 40, dur: big ? 0.5 : 0.3, vol: 0.25 });
  }

  pickup(combo = 1) {
    if (!this.ctx || this.muted) return;
    const base = 660 * Math.pow(2, Math.min(combo, 8) / 12);
    blip(this.ctx, this.master, { type: 'sine', from: base, to: base * 1.5, dur: 0.1, vol: 0.14 });
    blip(this.ctx, this.master, { type: 'sine', from: base * 1.5, to: base * 2, dur: 0.1, vol: 0.1, delay: 0.05 });
  }

  powerup() {
    if (!this.ctx || this.muted) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      blip(this.ctx, this.master, { type: 'triangle', from: f, to: f, dur: 0.16, vol: 0.14, delay: i * 0.07 });
    });
  }

  playerHit() {
    if (!this.ctx || this.muted) return;
    noiseBurst(this.ctx, this.master, { dur: 0.35, vol: 0.3, freq: 600 });
    blip(this.ctx, this.master, { type: 'sawtooth', from: 220, to: 50, dur: 0.35, vol: 0.22 });
  }

  waveClear() {
    if (!this.ctx || this.muted) return;
    [392, 523.25, 659.25].forEach((f, i) => {
      blip(this.ctx, this.master, { type: 'triangle', from: f, to: f, dur: 0.2, vol: 0.16, delay: i * 0.09 });
    });
  }

  bossAlarm() {
    if (!this.ctx || this.muted) return;
    for (let i = 0; i < 3; i++) {
      blip(this.ctx, this.master, { type: 'sawtooth', from: 440, to: 440, dur: 0.16, vol: 0.14, delay: i * 0.22 });
      blip(this.ctx, this.master, { type: 'sawtooth', from: 330, to: 330, dur: 0.16, vol: 0.14, delay: i * 0.22 + 0.11 });
    }
  }

  gameOver() {
    if (!this.ctx || this.muted) return;
    [392, 311.13, 233.08, 155.56].forEach((f, i) => {
      blip(this.ctx, this.master, { type: 'triangle', from: f, to: f * 0.98, dur: 0.35, vol: 0.16, delay: i * 0.18 });
    });
  }

  victory() {
    if (!this.ctx || this.muted) return;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      blip(this.ctx, this.master, { type: 'triangle', from: f, to: f, dur: 0.3, vol: 0.15, delay: i * 0.1 });
    });
  }

  click() {
    if (!this.ctx || this.muted) return;
    blip(this.ctx, this.master, { type: 'sine', from: 700, to: 900, dur: 0.06, vol: 0.1 });
  }

  /** Start the looping bass + pad sequencer (16th-note steps at 112 BPM). */
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const stepDur = 60 / 112 / 4;
    this.musicTimer = window.setInterval(() => {
      if (this.muted || !this.ctx) return;
      const i = this.step % 16;
      const bass = BASS_LINE[i];
      if (bass) {
        blip(this.ctx, this.musicGain, { type: 'triangle', from: bass, to: bass, dur: stepDur * 0.9, vol: 0.5 });
      }
      if (this.step % 16 === 0) {
        const chord = PAD_CHORDS[(this.step / 16 | 0) % PAD_CHORDS.length];
        chord.forEach((f) => {
          blip(this.ctx, this.musicGain, { type: 'sine', from: f, to: f, dur: stepDur * 15, vol: 0.12 });
        });
      }
      this.step++;
    }, stepDur * 1000);
  }

  stopMusic() {
    if (this.musicTimer) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
