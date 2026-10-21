/**
 * Tiny synthesised sounds, no audio files. Silent until the visitor turns sound on.
 *
 * When on, the only thing you really hear is soft background music: slow,
 * warm chords that drift through a dark reverb, with the odd faint bell on
 * top. It sits far back in the mix. The power-on and glitch sounds are kept
 * very quiet, and typing makes no sound at all.
 */

/** Four gentle chords (Hz), low and close together, each held for one bar. */
const CHORDS = [
  [130.81, 196.0, 246.94, 329.63], // Cmaj7
  [110.0, 164.81, 220.0, 261.63], // Am7
  [87.31, 174.61, 220.0, 261.63], // Fmaj7
  [98.0, 146.83, 196.0, 246.94], // G6-ish
];
/** C major pentatonic, two octaves up, for the occasional bell. */
const BELLS = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

const BAR = 9; // seconds per chord
const LEVEL = 0.03; // master volume of the music

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

  /** A long, dark reverb tail, generated: decaying noise as the impulse response. */
  private reverb(ac: AudioContext) {
    const len = Math.floor(ac.sampleRate * 4.5);
    const ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
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
    out.gain.linearRampToValueAtTime(LEVEL, t + 4);
    out.connect(ac.destination);

    // everything goes through a soft low-pass, then mostly into the reverb
    const tone = ac.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 1400;
    tone.Q.value = 0.3;
    const dry = ac.createGain();
    dry.gain.value = 0.45;
    const wet = ac.createGain();
    wet.gain.value = 0.9;
    tone.connect(dry).connect(out);
    tone.connect(this.reverb(ac)).connect(wet).connect(out);

    const music = { out, timer: 0, next: t + 0.1, bar: 0 };
    this.music = music;

    // schedule a little ahead, so timers never cause gaps
    const tick = () => {
      if (this.music !== music) return;
      while (music.next < ac.currentTime + 2) {
        this.chord(ac, tone, CHORDS[music.bar % CHORDS.length], music.next);
        // a faint bell or two somewhere in the bar, not every time
        const bells = Math.random() < 0.6 ? 1 : 2;
        for (let i = 0; i < bells; i++) {
          if (Math.random() < 0.75) {
            const f = BELLS[Math.floor(Math.random() * BELLS.length)];
            this.bell(ac, tone, f, music.next + 1.5 + Math.random() * (BAR - 3));
          }
        }
        music.next += BAR;
        music.bar++;
      }
    };
    tick();
    music.timer = window.setInterval(tick, 1000);
  }

  /** A chord that swells in slowly and fades out slowly, overlapping the next. */
  private chord(ac: AudioContext, bus: AudioNode, notes: number[], at: number) {
    const hold = BAR + 3;
    for (const [i, f] of notes.entries()) {
      const g = ac.createGain();
      const peak = (i === 0 ? 0.22 : 0.14) / notes.length;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(peak, at + 3.5);
      g.gain.setValueAtTime(peak, at + hold - 4.5);
      g.gain.linearRampToValueAtTime(0, at + hold);
      g.connect(bus);
      // a sine and a quiet triangle, slightly detuned, for warmth
      for (const [type, detune, level] of [
        ["sine", -3, 1],
        ["triangle", 4, 0.25],
      ] as const) {
        const o = ac.createOscillator();
        o.type = type;
        o.frequency.value = f;
        o.detune.value = detune;
        const og = ac.createGain();
        og.gain.value = level;
        o.connect(og).connect(g);
        o.start(at);
        o.stop(at + hold + 0.1);
      }
    }
  }

  /** A soft, distant bell: quick attack, long fade, mostly reverb. */
  private bell(ac: AudioContext, bus: AudioNode, f: number, at: number) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.028, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 3.5);
    g.connect(bus);
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    o.connect(g);
    o.start(at);
    o.stop(at + 3.6);
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
