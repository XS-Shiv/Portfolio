"""Generate Shiv's State 2 voice clips from the dialogue file.

Reads the spoken lines straight from src/hero/content.ts (intro.lines, then
intro.body), synthesises each with Kokoro (offline TTS), gives it a light
"human but a machine" treatment, and writes:

  public/voice/line-<n>.mp3     one small mono clip per line
  public/voice/manifest.json    the exact text of each clip, its duration and
                                when each word starts (for caption sync)

The site only plays a clip whose text still matches the line in content.ts;
an edited line falls back to the browser's own voice until this is re-run.

Run:  python3 scripts/make_voice.py --model kokoro.onnx --voices voices.bin
Needs: pip install kokoro-onnx soundfile numpy scipy, plus ffmpeg on PATH.
Model files: github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0).
"""
import argparse
import json
import re
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/voice"
VOICE = "am_michael"
SPEED = 1.02
SR_OUT = 24000
PHRASE_GAP = 0.32  # seconds between the two sentences of a line


def spoken_lines():
    js = "import('./src/hero/content.ts').then(m=>console.log(JSON.stringify([...m.intro.lines,...m.intro.body])))"
    out = subprocess.run(
        ["node", "--experimental-strip-types", "--no-warnings", "-e", js],
        cwd=ROOT, capture_output=True, text=True, check=True,
    ).stdout
    return json.loads(out)


def trim(a, sr, thresh=0.012):
    env = np.abs(a)
    idx = np.where(env > thresh)[0]
    if len(idx) == 0:
        return a, 0
    s = max(0, idx[0] - int(0.015 * sr))
    e = min(len(a), idx[-1] + int(0.04 * sr))
    return a[s:e], s


def machine(a, sr):
    """Light processing: a touch of band-limiting, a faint comb (metallic), a hint of bit-depth grain."""
    b, c = signal.butter(2, [110, 7600], btype="band", fs=sr)
    a = signal.lfilter(b, c, a)
    d = int(0.0065 * sr)
    comb = np.zeros_like(a)
    comb[d:] = a[:-d]
    a = a + 0.22 * comb
    t = np.arange(len(a)) / sr
    a = a * (1 + 0.035 * np.sin(2 * np.pi * 31 * t))  # the faintest electrical flutter
    q = 2 ** 11
    a = np.round(a * q) / q
    return a / (np.max(np.abs(a)) + 1e-9) * 0.89


def word_weights(phrase):
    """Rough speaking weight of each word: vowel groups (syllables) plus a little for length."""
    words = phrase.split()
    w = [max(1, len(re.findall(r"[aeiouy]+", x.lower()))) + 0.15 * len(x) for x in words]
    return words, w


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--voices", required=True)
    ap.add_argument("--voice", default=VOICE)
    args = ap.parse_args()

    from kokoro_onnx import Kokoro

    k = Kokoro(args.model, args.voices)
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {"voice": args.voice, "tool": "Kokoro v1.0 (kokoro-onnx)", "lines": []}
    total = 0
    for n, text in enumerate(spoken_lines()):
        phrases = [p.strip() for p in text.split("\n") if p.strip()]
        parts, words = [], []
        tpos = 0.0
        for i, ph in enumerate(phrases):
            audio, sr = k.create(ph + ".", voice=args.voice, speed=SPEED, lang="en-us")
            audio, _ = trim(audio.astype(np.float32), sr)
            dur = len(audio) / sr
            ws, wt = word_weights(ph)
            acc = 0.0
            for wd, ww in zip(ws, wt):
                words.append(round(tpos + dur * acc / sum(wt), 3))
                acc += ww
            parts.append(audio)
            tpos += dur
            if i < len(phrases) - 1:
                parts.append(np.zeros(int(PHRASE_GAP * sr), dtype=np.float32))
                tpos += PHRASE_GAP
        clip = machine(np.concatenate(parts), sr)
        if sr != SR_OUT:
            clip = signal.resample_poly(clip, SR_OUT, sr)
        name = f"line-{n}.mp3"
        with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
            sf.write(tmp.name, clip, SR_OUT)
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", tmp.name, "-ac", "1", "-b:a", "48k", str(OUT / name)],
                check=True,
            )
        size = (OUT / name).stat().st_size
        total += size
        manifest["lines"].append(
            {"text": text, "src": f"/voice/{name}", "duration": round(len(clip) / SR_OUT, 3), "words": words}
        )
        print(f"{name}: {len(clip) / SR_OUT:.2f}s, {size / 1024:.1f} KB  {text!r}")
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"total {total / 1024:.1f} KB")


if __name__ == "__main__":
    main()
