import type { Sound } from "./sound";

/**
 * Shiv's voice. Each line in State 2 is spoken while its words appear.
 *
 * - A pre-generated clip (public/voice, made by scripts/make_voice.py) is used
 *   when its text still matches the line exactly. It plays through the sound's
 *   analyser, so the face and the buttons follow its real loudness, and words
 *   appear at the times stored with it.
 * - An edited line without a fresh clip falls back to the browser's own voice
 *   (speechSynthesis), with words following its word-boundary events.
 * - Muted, the words still appear in the voice's rhythm, silently.
 * Clips load only once State 2 starts, so they never compete with first paint.
 */

type Clip = { text: string; src: string; duration: number; words: number[] };
type Manifest = { voice: string; lines: Clip[] };

/** Silent or browser-voice pacing when there is no clip: about 15 characters a second. */
const MS_PER_CHAR = 64;

/** Start index of every word, and the index just past its end. */
function wordEnds(text: string) {
  const ends: number[] = [];
  const re = /\S+/g;
  for (let m = re.exec(text); m; m = re.exec(text)) ends.push(m.index + m[0].length);
  return ends;
}

export type Speech = {
  /** Show the whole line now and stop its audio; onDone fires. */
  finish: () => void;
  /** Stop silently: no more callbacks. */
  cancel: () => void;
};

export class Narrator {
  private manifest: Promise<Manifest | null> | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private current: { stop: () => void } | null = null;
  private fakeLevel = 0;
  private fakeUntil = 0;

  constructor(private sound: Sound) {}

  /** Fetch the clip list and decode the clips. Safe to call more than once. */
  load() {
    if (!this.manifest) {
      this.manifest = fetch("/voice/manifest.json")
        .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : null))
        .catch(() => null);
      void this.manifest.then((m) => m?.lines.forEach((c) => this.buffer(c.src)));
    }
    return this.manifest;
  }

  private buffer(src: string) {
    let b = this.buffers.get(src);
    if (!b) {
      const ac = this.sound.audio();
      b = ac
        ? fetch(src)
            .then((r) => r.arrayBuffer())
            .then((a) => ac.decodeAudioData(a))
            .catch(() => null)
        : Promise.resolve(null);
      this.buffers.set(src, b);
    }
    return b;
  }

  /** Loudness of his voice right now, 0..1 (the browser voice gets a word-by-word envelope). */
  level(now = performance.now()) {
    const real = this.sound.enabled && this.sound.unlocked ? this.sound.voiceLevel() : 0;
    if (now < this.fakeUntil) this.fakeLevel = Math.max(this.fakeLevel * 0.9, 0);
    else this.fakeLevel *= 0.8;
    return Math.max(real, this.fakeLevel);
  }

  /**
   * Speak one line. onShow(n) is called with how many characters to show as
   * words arrive; onDone once the line has been said (or finished early).
   */
  speak(text: string, onShow: (n: number) => void, onDone: () => void): Speech {
    const ends = wordEnds(text);
    let done = false;
    let cancelled = false;
    const timers: number[] = [];
    let stopAudio = () => {};

    const end = () => {
      if (done || cancelled) return;
      done = true;
      timers.forEach(clearTimeout);
      this.sound.duck(false);
      onShow(text.length);
      onDone();
    };
    const schedule = (times: number[], total: number) => {
      times.forEach((t, k) => timers.push(window.setTimeout(() => !cancelled && onShow(ends[k]), t * 1000)));
      timers.push(window.setTimeout(end, total * 1000 + 40));
    };
    const estimate = () => {
      let acc = 0;
      const times: number[] = [];
      const re = /\S+\s*/g;
      for (let m = re.exec(text); m; m = re.exec(text)) {
        times.push(acc);
        acc += (m[0].length * MS_PER_CHAR + (/[,.\n]/.test(m[0]) ? 180 : 0)) / 1000;
      }
      return { times, total: acc };
    };

    this.current?.stop();
    const handle = { stop: () => stopAudio() };
    this.current = handle;
    const audible = this.sound.enabled && this.sound.unlocked;

    void this.load().then(async (m) => {
      if (cancelled || done) return;
      const clip = m?.lines.find((c) => c.text === text);
      if (clip) {
        const buf = audible ? await this.buffer(clip.src) : null;
        if (cancelled || done) return;
        const ac = this.sound.audio();
        const out = this.sound.voiceOut();
        if (buf && ac && out && audible) {
          const src = ac.createBufferSource();
          src.buffer = buf;
          const g = ac.createGain();
          src.connect(g).connect(out);
          src.start();
          this.sound.duck(true);
          stopAudio = () => {
            const t = ac.currentTime;
            g.gain.setValueAtTime(g.gain.value, t);
            g.gain.linearRampToValueAtTime(0, t + 0.08);
            try {
              src.stop(t + 0.1);
            } catch {
              /* already stopped */
            }
          };
        }
        schedule(clip.words, clip.duration);
        return;
      }
      // no clip for this exact text: the browser's voice, or silent pacing when muted
      const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
      if (audible && synth) {
        const u = new SpeechSynthesisUtterance(text.replace(/\n/g, ". "));
        u.rate = 1.02;
        let spoken = 0;
        u.onboundary = (e) => {
          if (e.name !== "word" || cancelled) return;
          while (spoken < ends.length && ends[spoken] <= e.charIndex) spoken++;
          onShow(ends[Math.min(spoken, ends.length - 1)]);
          this.fakeLevel = 0.75;
          this.fakeUntil = performance.now() + 160;
        };
        u.onend = end;
        u.onerror = end;
        synth.cancel();
        synth.speak(u);
        this.sound.duck(true);
        stopAudio = () => synth.cancel();
        // some browsers never fire onend; never leave the line hanging
        timers.push(window.setTimeout(end, estimate().total * 1000 * 2.5 + 1500));
        return;
      }
      const { times, total } = estimate();
      schedule(times, total);
    });

    return {
      finish: () => {
        stopAudio();
        end();
      },
      cancel: () => {
        cancelled = true;
        timers.forEach(clearTimeout);
        stopAudio();
        this.sound.duck(false);
      },
    };
  }

  /** Say several lines one after another without driving any text (reduced motion). */
  queue(lines: string[]): Speech {
    let i = 0;
    let cur: Speech | null = null;
    let stopped = false;
    const next = () => {
      if (stopped || i >= lines.length) return;
      cur = this.speak(lines[i++], () => {}, () => window.setTimeout(next, 120));
    };
    next();
    return {
      finish: () => {
        stopped = true;
        cur?.cancel();
      },
      cancel: () => {
        stopped = true;
        cur?.cancel();
      },
    };
  }

  /** Stop whatever is being said. */
  stop() {
    this.current?.stop();
    this.current = null;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    this.sound.duck(false);
  }
}
