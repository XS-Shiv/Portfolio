import type { Spoken } from "./content";
import type { Sound } from "./sound";
import { clipKey, type Manifest, segmentsOf } from "./speech";

/**
 * Shiv's voice. Each line in State 2 is spoken while its words appear.
 *
 * - A line is split into phrases (speech.ts); each phrase has its own clip in
 *   public/voice (made by scripts/generate-voice.ts), and the pauses between
 *   them come from VOICE in timings.ts. Clips play through the sound's
 *   analyser, so the face and the buttons follow the voice's real loudness.
 * - The words on screen follow the spoken words (the spoken text may carry
 *   extra commas or pauses; the screen text is mapped onto it word for word).
 * - A line with a phrase that has no clip yet is read by the browser's own voice.
 * - Muted, the words still appear in the voice's rhythm, silently.
 * Clips load only once State 2 starts, so they never compete with first paint.
 */

/** Silent or browser-voice pacing when there is no clip: about 15 characters a second. */
const MS_PER_CHAR = 64;

/** Index just past the end of every word. */
function wordEnds(text: string) {
  const ends: number[] = [];
  const re = /\S+/g;
  for (let m = re.exec(text); m; m = re.exec(text)) ends.push(m.index + m[0].length);
  return ends;
}

const plain = (spoken: string) => spoken.replace(/\s*\/\/?\s*/g, " ");

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
      void this.manifest.then((m) => m && Object.values(m.clips).forEach((c) => this.buffer(c.src)));
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
   * Speak one line. onShow(n) is called with how many characters of the screen
   * text to show as words arrive; onDone once the line has been said (or finished early).
   */
  speak(line: Spoken, onShow: (n: number) => void, onDone: () => void): Speech {
    const text = line.text;
    const spoken = line.spoken ?? line.text;
    const ends = wordEnds(text);
    let done = false;
    let cancelled = false;
    const timers: number[] = [];
    let stopAudio = () => {};

    /** Spoken word i has started: show the matching share of the screen words. */
    const showSpoken = (i: number, total: number) => {
      if (cancelled || done) return;
      const k = Math.min(ends.length, Math.ceil(((i + 1) * ends.length) / Math.max(1, total)));
      if (k > 0) onShow(ends[k - 1]);
    };
    const end = () => {
      if (done || cancelled) return;
      done = true;
      timers.forEach(clearTimeout);
      this.sound.duck(false);
      onShow(text.length);
      onDone();
    };
    const schedule = (times: number[], total: number) => {
      times.forEach((t, i) => timers.push(window.setTimeout(() => showSpoken(i, times.length), t * 1000)));
      timers.push(window.setTimeout(end, total * 1000 + 40));
    };
    const estimate = () => {
      let acc = 0;
      const times: number[] = [];
      for (const seg of segmentsOf(spoken)) {
        const re = /\S+\s*/g;
        for (let m = re.exec(seg.text); m; m = re.exec(seg.text)) {
          times.push(acc);
          acc += (m[0].length * MS_PER_CHAR + (/[,.…]/.test(m[0]) ? 160 : 0)) / 1000;
        }
        acc += seg.pause / 1000;
      }
      return { times, total: acc };
    };

    this.current?.stop();
    const handle = { stop: () => stopAudio() };
    this.current = handle;
    const audible = this.sound.enabled && this.sound.unlocked;

    void this.load().then(async (m) => {
      if (cancelled || done) return;
      const segs = segmentsOf(spoken);
      const clips = m ? segs.map((s) => m.clips[clipKey(s.text, m)]) : [];
      if (m && clips.every(Boolean)) {
        // the timeline: each clip, then its pause
        let t = 0;
        const starts: number[] = [];
        const times: number[] = [];
        clips.forEach((c, i) => {
          starts.push(t);
          c.words.forEach((w) => times.push(t + w));
          t += c.duration + (i < clips.length - 1 ? segs[i].pause / 1000 : 0);
        });
        const bufs = audible ? await Promise.all(clips.map((c) => this.buffer(c.src))) : [];
        if (cancelled || done) return;
        const ac = this.sound.audio();
        const out = this.sound.voiceOut();
        if (audible && ac && out && bufs.length && bufs.every(Boolean)) {
          const g = ac.createGain();
          g.connect(out);
          const at = ac.currentTime + 0.04;
          const srcs = bufs.map((b, i) => {
            const s = ac.createBufferSource();
            s.buffer = b;
            s.connect(g);
            s.start(at + starts[i]);
            return s;
          });
          this.sound.duck(true);
          stopAudio = () => {
            const now = ac.currentTime;
            g.gain.setValueAtTime(g.gain.value, now);
            g.gain.linearRampToValueAtTime(0, now + 0.08);
            srcs.forEach((s) => {
              try {
                s.stop(now + 0.1);
              } catch {
                /* already stopped */
              }
            });
          };
        }
        schedule(times, t);
        return;
      }
      // a phrase without a clip: the browser's voice, or silent pacing when muted
      const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
      if (audible && synth) {
        const say = plain(spoken);
        const sayEnds = wordEnds(say);
        const u = new SpeechSynthesisUtterance(say);
        u.rate = 0.95;
        u.lang = "en-IN";
        u.onboundary = (e) => {
          if (e.name !== "word" || cancelled) return;
          let i = 0;
          while (i < sayEnds.length - 1 && sayEnds[i] <= e.charIndex) i++;
          showSpoken(i, sayEnds.length);
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
  queue(lines: Spoken[], gap: number): Speech {
    let i = 0;
    let cur: Speech | null = null;
    let stopped = false;
    const next = () => {
      if (stopped || i >= lines.length) return;
      cur = this.speak(lines[i++], () => {}, () => window.setTimeout(next, gap));
    };
    next();
    const stop = () => {
      stopped = true;
      cur?.cancel();
    };
    return { finish: stop, cancel: stop };
  }

  /** Stop whatever is being said. */
  stop() {
    this.current?.stop();
    this.current = null;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    this.sound.duck(false);
  }
}
