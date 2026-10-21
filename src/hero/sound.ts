/**
 * Tiny synthesised sounds, no audio files. Silent until the visitor turns sound on.
 * When on: a soft ambient room tone the whole time, a hum on power-on, key clicks
 * while text types, and a short static blip when the machine slips.
 */
export class Sound {
  enabled = false;
  private ctx: AudioContext | null = null;
  private lastClick = 0;
  private ambient: { out: GainNode; nodes: AudioScheduledSourceNode[] } | null = null;

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
    if (on) this.startAmbient();
    else this.stopAmbient();
  }

  /** A calm, low pad: two slow detuned tones and filtered air, breathing in and out. */
  private startAmbient() {
    const ac = this.audio();
    if (!ac || this.ambient) return;
    const t = ac.currentTime;
    const out = ac.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(0.05, t + 2.5);
    out.connect(ac.destination);

    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    lp.Q.value = 0.4;
    lp.connect(out);

    const nodes: AudioScheduledSourceNode[] = [];
    // a soft open fifth, slightly detuned so it shimmers
    for (const [f, g, detune] of [
      [110, 0.5, -4],
      [164.8, 0.32, 5],
      [220.4, 0.12, 0],
    ] as const) {
      const o = ac.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      o.detune.value = detune;
      const og = ac.createGain();
      og.gain.value = g;
      o.connect(og).connect(lp);
      nodes.push(o);
    }

    // filtered noise, like the air in a quiet room
    const len = ac.sampleRate * 3;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; // brownish
      d[i] = last * 3.5;
    }
    const air = ac.createBufferSource();
    air.buffer = buf;
    air.loop = true;
    const airGain = ac.createGain();
    airGain.gain.value = 0.35;
    air.connect(airGain).connect(lp);
    nodes.push(air);

    // slow swell on the filter, so it breathes
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ac.createGain();
    lfoGain.gain.value = 380;
    lfo.connect(lfoGain).connect(lp.frequency);
    nodes.push(lfo);

    nodes.forEach((n) => n.start(t));
    this.ambient = { out, nodes };
  }

  private stopAmbient() {
    const amb = this.ambient;
    const ac = this.ctx;
    if (!amb || !ac) return;
    this.ambient = null;
    const t = ac.currentTime;
    amb.out.gain.cancelScheduledValues(t);
    amb.out.gain.setValueAtTime(amb.out.gain.value, t);
    amb.out.gain.linearRampToValueAtTime(0, t + 0.6);
    amb.nodes.forEach((n) => n.stop(t + 0.7));
  }

  /** A short burst of static when the machine slips into "we". */
  glitch() {
    if (!this.enabled) return;
    const ac = this.audio();
    if (!ac) return;
    const t = ac.currentTime;
    const len = Math.floor(ac.sampleRate * 0.18);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const gate = Math.floor(i / (ac.sampleRate * 0.02)) % 2 ? 0.35 : 1;
      d[i] = (Math.random() * 2 - 1) * gate * (1 - i / len);
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2400;
    bp.Q.value = 0.8;
    const g = ac.createGain();
    g.gain.value = 0.06;
    src.connect(bp).connect(g).connect(ac.destination);
    src.start(t);
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
