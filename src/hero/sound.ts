/**
 * Tiny synthesised sounds, no audio files. Silent until the visitor turns sound on.
 */
export class Sound {
  enabled = false;
  private ctx: AudioContext | null = null;
  private lastClick = 0;

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
    if (on) this.audio();
  }

  /** CRT power-on: a low hum that swells and settles, with a faint high whine. */
  hum() {
    if (!this.enabled) return;
    const ac = this.audio();
    if (!ac) return;
    const t = ac.currentTime;
    const out = ac.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(0.09, t + 0.05);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    out.connect(ac.destination);

    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 420;
    lp.connect(out);
    const low = ac.createOscillator();
    low.type = "sawtooth";
    low.frequency.setValueAtTime(48, t);
    low.frequency.exponentialRampToValueAtTime(60, t + 0.3);
    low.connect(lp);

    const whineGain = ac.createGain();
    whineGain.gain.value = 0.012;
    whineGain.connect(out);
    const whine = ac.createOscillator();
    whine.type = "sine";
    whine.frequency.value = 7800;
    whine.connect(whineGain);

    for (const o of [low, whine]) {
      o.start(t);
      o.stop(t + 1);
    }
  }

  /** A soft key click while text types. */
  click() {
    if (!this.enabled) return;
    const ac = this.audio();
    if (!ac) return;
    const now = performance.now();
    if (now - this.lastClick < 45) return;
    this.lastClick = now;
    const t = ac.currentTime;
    const len = Math.floor(ac.sampleRate * 0.025);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800 + Math.random() * 900;
    bp.Q.value = 1.2;
    const g = ac.createGain();
    g.gain.value = 0.05;
    src.connect(bp).connect(g).connect(ac.destination);
    src.start(t);
  }
}
