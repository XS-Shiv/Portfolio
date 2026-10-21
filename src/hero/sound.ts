/**
 * Tiny synthesised sounds, no audio files. Silent until the visitor turns sound on.
 *
 * When on, the only thing you really hear is a slow, soft instrumental: a warm
 * electric-piano arpeggio over a gentle IV-iii-ii-I progression, a round bass
 * note on each bar, a faint pad underneath and a few high melody notes, all in
 * a soft reverb and kept far back in the mix. The power-on and glitch sounds
 * are very quiet, and typing makes no sound at all.
 */

const BPM = 66;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const LEVEL = 0.05; // master volume of the music

/** Fmaj7 - Em7 - Dm7 - Cmaj9, as MIDI notes: [bass, ...chord]. */
const PROGRESSION = [
  [41, 53, 57, 60, 64],
  [40, 52, 55, 59, 62],
  [38, 50, 53, 57, 60],
  [36, 48, 52, 55, 59, 62],
];
/** The arpeggio walks these chord-tone positions on eighth notes; 12 = an octave up. */
const ARP: [number, number][] = [
  [0, 0],
  [1, 0],
  [2, 0],
  [3, 0],
  [1, 12],
  [2, 0],
  [3, 0],
  [2, 0],
];
/** C major pentatonic, up high, for the odd melody note. */
const MELODY = [72, 74, 76, 79, 81];

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const jitter = (amount: number) => (Math.random() * 2 - 1) * amount;

export class Sound {
  enabled = false;
  private ctx: AudioContext | null = null;
  private music: { out: GainNode; timer: number; next: number; bar: number } | null = null;

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

  setEnabled(on: boolean) {
    this.enabled = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  /** A soft room reverb, generated: decaying noise as the impulse response. */
  private reverb(ac: AudioContext) {
    const len = Math.floor(ac.sampleRate * 3.2);
    const ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
    }
    const conv = ac.createConvolver();
    conv.buffer = ir;
    return conv;
  }

  private startMusic() {
    const ac = this.audio();
    if (!ac || this.music) return;
    const t = ac.currentTime;

    const out = ac.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(LEVEL, t + 3);
    out.connect(ac.destination);

    // a warm tone: roll off the top, then mix dry with a soft room
    const tone = ac.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2400;
    tone.Q.value = 0.4;
    const dry = ac.createGain();
    dry.gain.value = 0.7;
    const wet = ac.createGain();
    wet.gain.value = 0.55;
    tone.connect(dry).connect(out);
    tone.connect(this.reverb(ac)).connect(wet).connect(out);

    const music = { out, timer: 0, next: t + 0.2, bar: 0 };
    this.music = music;

    // schedule a few seconds ahead, so timers never cause gaps
    const tick = () => {
      if (this.music !== music) return;
      while (music.next < ac.currentTime + 3) {
        this.bar(ac, tone, music.bar, music.next);
        music.next += BAR;
        music.bar++;
      }
    };
    tick();
    music.timer = window.setInterval(tick, 500);
  }

  private bar(ac: AudioContext, bus: AudioNode, n: number, at: number) {
    const [bass, ...chord] = PROGRESSION[n % PROGRESSION.length];
    // the first pass of the cycle breathes in quarter notes; after that, eighths
    const eighths = n >= PROGRESSION.length;
    this.piano(ac, bus, bass, at, 0.55, 3.2);
    this.pad(ac, bus, chord, at);
    ARP.forEach(([pos, up], i) => {
      if (!eighths && i % 2) return;
      const note = chord[pos % chord.length] + up;
      const when = at + i * (BEAT / 2) + jitter(0.012);
      this.piano(ac, bus, note, when, (i === 0 ? 0.42 : 0.32) + jitter(0.06), 1.6);
    });
    // a few melody notes on every other bar
    if (n % 2 === 1) {
      const count = 1 + Math.floor(Math.random() * 2);
      for (let k = 0; k < count; k++) {
        const note = MELODY[Math.floor(Math.random() * MELODY.length)];
        this.piano(ac, bus, note, at + BEAT * (1 + k * 1.5) + jitter(0.02), 0.22 + jitter(0.04), 2.4);
      }
    }
  }

  /** A soft electric-piano note: a few sine partials, a quick attack and a natural fade. */
  private piano(ac: AudioContext, bus: AudioNode, midi: number, at: number, vel: number, decay: number) {
    const f = hz(midi);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vel * 0.16, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    g.connect(bus);
    for (const [mult, level, fade] of [
      [1, 1, 1],
      [2, 0.28, 0.6],
      [3, 0.08, 0.35],
      [4.02, 0.03, 0.25],
    ] as const) {
      const o = ac.createOscillator();
      o.type = "sine";
      o.frequency.value = f * mult;
      const pg = ac.createGain();
      pg.gain.setValueAtTime(level, at);
      pg.gain.exponentialRampToValueAtTime(0.0001, at + decay * fade);
      o.connect(pg).connect(g);
      o.start(at);
      o.stop(at + decay + 0.05);
    }
  }

  /** A faint sustained chord underneath, swelling in and out with the bar. */
  private pad(ac: AudioContext, bus: AudioNode, chord: number[], at: number) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.012, at + 1.2);
    g.gain.linearRampToValueAtTime(0, at + BAR + 0.6);
    g.connect(bus);
    for (const midi of chord.slice(0, 4)) {
      const o = ac.createOscillator();
      o.type = "triangle";
      o.frequency.value = hz(midi);
      o.detune.value = jitter(5);
      o.connect(g);
      o.start(at);
      o.stop(at + BAR + 0.7);
    }
  }

  private stopMusic() {
    const m = this.music;
    const ac = this.ctx;
    if (!m || !ac) return;
    this.music = null;
    clearInterval(m.timer);
    const t = ac.currentTime;
    m.out.gain.cancelScheduledValues(t);
    m.out.gain.setValueAtTime(m.out.gain.value, t);
    m.out.gain.linearRampToValueAtTime(0, t + 1.2);
    window.setTimeout(() => m.out.disconnect(), 1500);
  }

  /** CRT power-on: a short, low, soft swell. */
  hum() {
    if (!this.enabled) return;
    const ac = this.audio();
    if (!ac) return;
    const t = ac.currentTime;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.025, t + 0.15);
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

  /** Typing is silent now; kept so callers don't need to change. */
  click() {}

  /** The faintest crackle when the machine slips into "we". */
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
