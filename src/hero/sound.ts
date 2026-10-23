/**
 * Sound: on by default, but browsers only start audio from a user gesture, so
 * nothing plays until the visitor's first click or key press. The speaker in
 * the top bar mutes everything (music, voice, effects) and the choice is
 * remembered.
 *
 * Music: "The Mountain" (public/audio/the-mountain.mp3), looped, faded through
 * a gain node so the fade also works on iOS. It ducks under Shiv's voice.
 * Voice: clips are played through an analyser, so the face and the buttons can
 * follow its real loudness (see voice.ts).
 */

const MUSIC_SRC = "/audio/the-mountain.mp3";
const MUSIC_LEVEL = 0.5;
const MUSIC_DUCKED = 0.16; // under the voice
const FADE_IN = 2.5; // seconds
const FADE_OUT = 0.9;
const KEY = "shiv-sound";

export function savedSoundPref(): boolean {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === null ? true : v === "on";
  } catch {
    return true;
  }
}

export class Sound {
  /** The visitor's choice (on by default). */
  enabled = true;
  /** True once a user gesture has unlocked audio. */
  unlocked = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: { el: HTMLAudioElement; gain: GainNode | null } | null = null;
  private analyser: AnalyserNode | null = null;
  private data: Float32Array<ArrayBuffer> | null = null;
  private stopTimer = 0;
  private ducked = false;
  private preloaded: HTMLAudioElement | null = null;

  constructor() {
    this.enabled = savedSoundPref();
  }

  /** Start downloading the track in the background, so it plays at once later. */
  preload() {
    if (typeof window === "undefined" || this.preloaded) return;
    this.preloaded = new Audio(MUSIC_SRC);
    this.preloaded.preload = "auto";
  }

  audio() {
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 1 : 0;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Call from a click or key handler: the first one unlocks audio and starts the music if sound is on. */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    this.audio();
    if (this.enabled) this.play();
  }

  /** The speaker button. Also a user gesture, so it may start audio. */
  setEnabled(on: boolean) {
    this.enabled = on;
    try {
      window.localStorage.setItem(KEY, on ? "on" : "off");
    } catch {
      /* private mode: the choice lasts for this visit */
    }
    this.unlocked = true;
    const ac = this.audio();
    if (ac && this.master) {
      const t = ac.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(on ? 1 : 0, t + (on ? 0.25 : 0.15));
    }
    if (on) this.play();
    else this.pause();
  }

  /** Stop everything without touching the visitor's saved choice (unmount). */
  dispose() {
    this.music?.el.pause();
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }

  /** Where voice clips go: an analyser (for loudness) in front of the master volume. */
  voiceOut(): AudioNode | null {
    const ac = this.audio();
    if (!ac || !this.master) return null;
    if (!this.analyser) {
      this.analyser = ac.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.5;
      this.data = new Float32Array(this.analyser.fftSize);
      this.analyser.connect(this.master);
    }
    return this.analyser;
  }

  /** Loudness of the voice right now, 0..1. */
  voiceLevel(): number {
    if (!this.analyser || !this.data) return 0;
    this.analyser.getFloatTimeDomainData(this.data);
    let s = 0;
    for (let i = 0; i < this.data.length; i++) s += this.data[i] * this.data[i];
    const rms = Math.sqrt(s / this.data.length);
    return Math.min(1, rms * 4.2);
  }

  /** Lower the music while he speaks. */
  duck(on: boolean) {
    if (on === this.ducked) return;
    this.ducked = on;
    const ac = this.ctx;
    const g = this.music?.gain;
    if (!ac || !g || !this.enabled) return;
    const t = ac.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(on ? MUSIC_DUCKED : MUSIC_LEVEL, t + (on ? 0.25 : 0.8));
  }

  private play() {
    const ac = this.audio();
    if (!this.music) {
      const el = this.preloaded ?? new Audio(MUSIC_SRC);
      el.loop = true;
      el.preload = "auto";
      if (!ac || !this.master) {
        this.music = { el, gain: null };
      } else {
        const src = ac.createMediaElementSource(el);
        const gain = ac.createGain();
        gain.gain.value = 0;
        src.connect(gain).connect(this.master);
        this.music = { el, gain };
      }
    }
    const { el, gain } = this.music;
    clearTimeout(this.stopTimer);
    void el.play().catch(() => {});
    if (ac && gain) {
      const t = ac.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(this.ducked ? MUSIC_DUCKED : MUSIC_LEVEL, t + FADE_IN);
    } else {
      el.volume = MUSIC_LEVEL;
    }
  }

  private pause() {
    const m = this.music;
    if (!m) return;
    clearTimeout(this.stopTimer);
    this.stopTimer = window.setTimeout(() => m.el.pause(), FADE_OUT * 1000 + 50);
    if (!m.gain) m.el.volume = 0;
  }

  /** CRT power-on: a short, low, soft swell. */
  hum() {
    if (!this.enabled || !this.unlocked) return;
    const ac = this.audio();
    if (!ac || !this.master) return;
    const t = ac.currentTime;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.03, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 300;
    g.connect(lp).connect(this.master);
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(55, t);
    o.frequency.exponentialRampToValueAtTime(82, t + 0.6);
    o.connect(g);
    o.start(t);
    o.stop(t + 1.2);
  }

  /** The faintest crackle, for the I -> we glitch. */
  glitch() {
    if (!this.enabled || !this.unlocked) return;
    const ac = this.audio();
    if (!ac || !this.master) return;
    const t = ac.currentTime;
    const len = Math.floor(ac.sampleRate * 0.12);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1800;
    const g = ac.createGain();
    g.gain.value = 0.012;
    src.connect(lp).connect(g).connect(this.master);
    src.start(t);
  }
}
