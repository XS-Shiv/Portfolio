import { VOICE } from "./timings";

/**
 * How a spoken line becomes clips: one clip per sentence or phrase, with a
 * deliberate pause after each. Shared by scripts/generate-voice.ts (which makes
 * the clips) and voice.ts (which plays them), so both split lines the same way.
 */

export type Segment = { text: string; pause: number };

/** Split a spoken line at " // " (punchline), " / " (beat) and sentence ends. */
export function segmentsOf(spoken: string): Segment[] {
  const out: Segment[] = [];
  const longs = spoken.split(/\s*\/\/\s*/);
  longs.forEach((long, i) => {
    const beats = long.split(/\s+\/\s+/);
    beats.forEach((beat, j) => {
      const sentences = beat.split(/(?<=[.!?…])\s+(?=\S)/);
      sentences.forEach((text, k) => {
        const t = text.trim();
        if (!t) return;
        const lastSentence = k === sentences.length - 1;
        const lastBeat = j === beats.length - 1;
        const pause = !lastSentence ? VOICE.sentence : !lastBeat ? VOICE.beat : i < longs.length - 1 ? VOICE.punchline : 0;
        out.push({ text: t, pause });
      });
    });
  });
  return out;
}

/** FNV-1a, as 8 hex digits: a short, stable key that works in Node and the browser. */
export function hashOf(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export type VoiceSettings = { engine: string; model: string; speaker: string; pace: number; pitch: number };

/** A clip's key: its text plus every setting that changes how it sounds. */
export const clipKey = (text: string, v: VoiceSettings) =>
  hashOf([v.engine, v.model, v.speaker, v.pace, v.pitch, text].join("|"));

export type Clip = { text: string; src: string; duration: number; words: number[] };
export type Manifest = VoiceSettings & { placeholder?: boolean; clips: Record<string, Clip> };

/** Rough speaking weight of each word (syllables plus a little for length), for timing words inside a clip. */
export function wordStarts(text: string, duration: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const w = words.map((x) => Math.max(1, (x.toLowerCase().match(/[aeiouy]+/g) ?? []).length) + 0.15 * x.length);
  const total = w.reduce((a, b) => a + b, 0);
  let acc = 0;
  return w.map((x) => {
    const t = (duration * acc) / total;
    acc += x;
    return Math.round(t * 1000) / 1000;
  });
}
