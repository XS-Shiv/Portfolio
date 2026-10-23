/**
 * Generate Shiv's State 2 voice clips with Sarvam AI (Bulbul TTS).
 *
 * Reads every spoken line from src/hero/content.ts, splits it into one clip
 * per sentence or phrase (src/hero/speech.ts), and writes:
 *   public/voice/<key>.mp3       one small clip per phrase
 *   public/voice/manifest.json   clips keyed by a hash of their text + voice settings
 * Only phrases whose text or voice settings changed are regenerated; clips no
 * longer used are deleted. Pauses between clips are added at playback from
 * VOICE in src/hero/timings.ts, so they need no regeneration.
 *
 * Setup: put SARVAM_API_KEY=... in .env.local (never committed). Get a key at
 * https://dashboard.sarvam.ai (new accounts get free credits; this uses a few
 * hundred characters). Needs ffmpeg on PATH.
 *
 *   npx tsx scripts/generate-voice.ts                         generate / update the clips
 *   npx tsx scripts/generate-voice.ts --audition shubh,aditya,rahul,kabir
 *        write voice-audition/<speaker>.mp3: the headline and body read by each,
 *        with the real pauses, to choose from. Then set VOICE.speaker and run again.
 *   --speaker <name>  --model bulbul:v2  --pace 0.9  --pitch -0.1  override VOICE
 *   --engine kokoro --kokoro-model <onnx> --kokoro-voices <bin>
 *        offline placeholder clips (scripts/kokoro_say.py), marked as placeholders
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { intro } from "../src/hero/content";
import { clipKey, type Clip, type Manifest, segmentsOf, type VoiceSettings, wordStarts } from "../src/hero/speech";
import { VOICE } from "../src/hero/timings";

const ROOT = resolve(__dirname, "..");
const OUT = join(ROOT, "public/voice");
const AUDITION = join(ROOT, "voice-audition");
const SR = 24000;
const API = "https://api.sarvam.ai/text-to-speech";

// ---------------------------------------------------------------- args, env

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

function loadEnv() {
  const f = join(ROOT, ".env.local");
  if (!existsSync(f)) return;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const settings: VoiceSettings = {
  engine: arg("engine") ?? "sarvam",
  model: arg("model") ?? VOICE.model,
  speaker: arg("speaker") ?? VOICE.speaker,
  pace: Number(arg("pace") ?? VOICE.pace),
  pitch: Number(arg("pitch") ?? VOICE.pitch),
};

// ---------------------------------------------------------------- synthesis

/** 16-bit mono PCM samples out of a WAV file. */
function pcmOf(wav: Buffer): { pcm: Int16Array; rate: number } {
  let off = 12;
  let rate = SR;
  while (off + 8 <= wav.length) {
    const id = wav.toString("ascii", off, off + 4);
    const size = wav.readUInt32LE(off + 4);
    if (id === "fmt ") rate = wav.readUInt32LE(off + 12);
    if (id === "data") {
      const end = Math.min(wav.length, off + 8 + size);
      const bytes = wav.subarray(off + 8, end - ((end - off - 8) % 2));
      return { pcm: new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)), rate };
    }
    off += 8 + size + (size % 2);
  }
  throw new Error("no data chunk in WAV");
}

/** Cut the silence at both ends, keeping a breath of lead-in and tail. */
function trim(pcm: Int16Array, rate: number) {
  const th = 0.012 * 32768;
  let a = 0;
  let b = pcm.length - 1;
  while (a < b && Math.abs(pcm[a]) < th) a++;
  while (b > a && Math.abs(pcm[b]) < th) b--;
  return pcm.slice(Math.max(0, a - Math.round(0.015 * rate)), Math.min(pcm.length, b + Math.round(0.05 * rate)));
}

async function sarvam(text: string, speaker: string): Promise<Buffer> {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error("SARVAM_API_KEY is missing: add it to .env.local (get one at https://dashboard.sarvam.ai)");
  const body: Record<string, unknown> = {
    text,
    language_code: VOICE.language,
    model: settings.model,
    speaker,
    pace: settings.pace,
    speech_sample_rate: SR,
    output_audio_codec: "wav",
  };
  if (settings.model === "bulbul:v2") body.pitch = settings.pitch;
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(API, {
      method: "POST",
      headers: { "api-subscription-key": key, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.status === 429 || r.status >= 500) {
      await new Promise((ok) => setTimeout(ok, 1500 * (attempt + 1)));
      continue;
    }
    if (r.status === 422 && "language_code" in body) {
      // older API versions name it target_language_code
      body.target_language_code = body.language_code;
      delete body.language_code;
      continue;
    }
    if (!r.ok) throw new Error(`Sarvam ${r.status}: ${await r.text()}`);
    const json = (await r.json()) as { audios: string[] };
    return Buffer.from(json.audios[0], "base64");
  }
  throw new Error("Sarvam: too many retries");
}

function kokoro(text: string): Buffer {
  const model = arg("kokoro-model");
  const voices = arg("kokoro-voices");
  if (!model || !voices) throw new Error("--engine kokoro needs --kokoro-model and --kokoro-voices");
  const r = spawnSync(
    "python3",
    [join(ROOT, "scripts/kokoro_say.py"), model, voices, settings.speaker, String(settings.pace), text],
    { maxBuffer: 64 << 20 },
  );
  if (r.status !== 0) throw new Error(`kokoro: ${r.stderr}`);
  return r.stdout;
}

async function say(text: string, speaker = settings.speaker) {
  const wav = settings.engine === "kokoro" ? kokoro(text) : await sarvam(text, speaker);
  const { pcm, rate } = pcmOf(wav);
  return { pcm: trim(pcm, rate), rate };
}

function mp3(pcm: Int16Array, rate: number, file: string) {
  const r = spawnSync(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-f", "s16le", "-ar", String(rate), "-ac", "1", "-i", "-", "-b:a", "48k", file],
    { input: Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength) },
  );
  if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr}`);
}

// ---------------------------------------------------------------- main

const lines = [...intro.lines, ...intro.body].map((l) => l.spoken ?? l.text);

async function audition(speakers: string[]) {
  mkdirSync(AUDITION, { recursive: true });
  for (const sp of speakers) {
    const parts: Int16Array[] = [];
    let rate = SR;
    for (const [n, line] of lines.entries()) {
      for (const seg of segmentsOf(line)) {
        const c = await say(seg.text, sp);
        rate = c.rate;
        parts.push(c.pcm, new Int16Array(Math.round((seg.pause / 1000) * rate)));
      }
      if (n < lines.length - 1) parts.push(new Int16Array(Math.round((VOICE.sentence / 1000) * rate)));
    }
    const all = new Int16Array(parts.reduce((a, p) => a + p.length, 0));
    let o = 0;
    for (const p of parts) {
      all.set(p, o);
      o += p.length;
    }
    const file = join(AUDITION, `${sp}.mp3`);
    mp3(all, rate, file);
    console.log(`${file}  ${(all.length / rate).toFixed(1)}s`);
  }
}

async function generate() {
  mkdirSync(OUT, { recursive: true });
  const mf = join(OUT, "manifest.json");
  const old: Partial<Manifest> = existsSync(mf) ? JSON.parse(readFileSync(mf, "utf8")) : {};
  const clips: Record<string, Clip> = {};
  let made = 0;
  let chars = 0;
  for (const line of lines) {
    for (const seg of segmentsOf(line)) {
      const key = clipKey(seg.text, settings);
      const src = `/voice/${key}.mp3`;
      const prev = old.clips?.[key];
      if (prev && existsSync(join(ROOT, "public", src))) {
        clips[key] = prev;
        continue;
      }
      const { pcm, rate } = await say(seg.text);
      mp3(pcm, rate, join(ROOT, "public", src));
      const duration = Math.round((pcm.length / rate) * 1000) / 1000;
      clips[key] = { text: seg.text, src, duration, words: wordStarts(seg.text, duration) };
      made++;
      chars += seg.text.length;
      console.log(`${key}.mp3  ${duration.toFixed(2)}s  ${seg.text}`);
    }
  }
  const manifest: Manifest = { ...settings, placeholder: settings.engine !== "sarvam" || undefined, clips };
  writeFileSync(mf, JSON.stringify(manifest, null, 2) + "\n");
  // drop clips nothing uses any more
  const keep = new Set(Object.values(clips).map((c) => c.src.split("/").pop()));
  for (const f of readdirSync(OUT)) if (f !== "manifest.json" && !keep.has(f)) unlinkSync(join(OUT, f));
  const kb = [...keep].reduce((a, f) => a + readFileSync(join(OUT, f!)).length, 0) / 1024;
  console.log(`${made} new clip(s), ${chars} characters sent; ${keep.size} clips, ${kb.toFixed(1)} KB in all`);
}

const list = arg("audition");
(list ? audition(list.split(",").map((s) => s.trim())) : generate()).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
