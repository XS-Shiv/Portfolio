/**
 * Sound, silent until a visitor's first click (or the top-bar speaker).
 *
 * Music: "The Mountain" (public/audio/the-mountain.mp3), looped, faded in and
 * out through a gain node so the fade also works on iOS, where an audio
 * element's own volume is fixed. Plus two tiny synthesised effects: a soft
 * power-on swell and a faint crackle.
 */

const MUSIC_SRC = "/audio/the-mountain.mp3";
const MUSIC_LEVEL = 0.55; // loud enough to be heard, still behind the page
const FADE_IN = 2.5; // seconds
const FADE_OUT = 0.9;

export class Sound {
  enabled = false;
  private ctx: AudioContext | null = null;
  private music: { el: HTMLAudioElement; gain: GainNode } | null = null;
  private stopTimer = 0;

  /** Start downloading the track in the background, so it plays at once later. */
  preload() {
    if (typeof window === "undefined" || this.preloaded) return;
    this.preloaded = new Audio(MUSIC_SRC);
    this.preloaded.preload = "auto";
  }
  private preloaded: HTMLAudioElement | null = null;

  private audio() {
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Call from inside a click or key handler: browsers only start audio from a user gesture. */
  setEnabled(on: boolean) {
    this.enabled = on;
    if (on) this.play();
    else this.pause();
  }

  private play() {
    const ac = this.audio();
    if (!this.music) {
      const el = this.preloaded ?? new Audio(MUSIC_SRC);
      el.loop = true;
      el.preload = "auto";
      if (!ac) {
        this.music = { el, gain: null as unknown as GainNode };
      } else {
        const src = ac.createMediaElementSource(el);
        const gain = ac.createGain();
        gain.gain.value = 0;
        src.connect(gain).connect(ac.destination);
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
      gain.gain.linearRampToValueAtTime(MUSIC_LEVEL, t + FADE_IN);
    } else {
      el.volume = MUSIC_LEVEL;
    }
  }

  private pause() {
    const m = this.music;
    if (!m) return;
    const ac = this.ctx;
    if (ac && m.gain) {
      const t = ac.currentTime;
      m.gain.gain.cancelScheduledValues(t);
      m.gain.gain.setValueAtTime(m.gain.gain.value, t);
      m.gain.gain.linearRampToValueAtTime(0, t + FADE_OUT);
    }
    clearTimeout(this.stopTimer);
    this.stopTimer = window.setTimeout(() => m.el.pause(), FADE_OUT * 1000 + 50);
  }

  /** CRT power-on: a short, low, soft swell. */
  hum() {
    if (!this.enabled) return;
    const ac = this.audio();
    if (!ac) return;
    const t = ac.currentTime;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.03, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 300;
    g.connect(lp).connect(ac.destination);
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(55, t);
    o.frequency.exponentialRampToValueAtTime(82, t + 0.6);
    o.connect(g);
    o.start(t);
    o.stop(t + 1.2);
  }

  /** The faintest crackle. */
  glitch() {
    if (!this.enabled) return;
    const ac = this.audio();
    if (!ac) return;
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
    src.connect(lp).connect(g).connect(ac.destination);
    src.start(t);
  }
}
