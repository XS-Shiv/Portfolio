"""Offline placeholder voice for scripts/generate-voice.ts --engine kokoro.

Usage: python3 scripts/kokoro_say.py <model.onnx> <voices.bin> <voice> <speed> <text>
Writes a 24 kHz mono 16-bit WAV to stdout. Needs: pip install kokoro-onnx soundfile.
"""
import io
import sys

import soundfile as sf
from kokoro_onnx import Kokoro

model, voices, voice, speed, text = sys.argv[1:6]
k = Kokoro(model, voices)
# Kokoro voices are named like am_michael; fall back to it for Sarvam speaker names
if voice not in k.get_voices():
    voice = "am_michael"
audio, sr = k.create(text, voice=voice, speed=float(speed), lang="en-us")
buf = io.BytesIO()
sf.write(buf, audio, sr, format="WAV", subtype="PCM_16")
sys.stdout.buffer.write(buf.getvalue())
