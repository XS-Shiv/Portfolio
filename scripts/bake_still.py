"""Bake the first-paint image from the live 3D character.

The page first paints a still image (public/character/front-blank.*), which is
also what browsers without WebGL keep, then crossfades to the live 3D head.
This renders the 3D character in its first pose with a blank screen (?still),
saves it, and prints where the screen glass and LEDs land, for
SCREEN_QUAD and LEDS in src/hero/character/geometry.ts.

Run with the site up (npm run build && npm start), then:
  python3 scripts/bake_still.py [--url http://localhost:3000] [--chrome /path/to/chrome]
Needs: pip install playwright pillow (and a Chromium).
"""
import argparse
import asyncio
import base64
import io
import json
from pathlib import Path

from PIL import Image
from playwright.async_api import async_playwright

OUT = Path(__file__).resolve().parents[1] / "public/character"


async def main(url, chrome):
    async with async_playwright() as p:
        b = await p.chromium.launch(
            executable_path=chrome,
            args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
        )
        pg = await b.new_page(viewport={"width": 1440, "height": 1300})
        await pg.goto(url.rstrip("/") + "/?still", wait_until="networkidle")
        info = None
        for _ in range(90):
            await pg.wait_for_timeout(2000)
            info = await pg.evaluate("window.__still || null")
            if info:
                break
        await pg.wait_for_timeout(3000)
        data = await pg.evaluate("document.querySelector('.character-canvas canvas').toDataURL('image/png')")
        await b.close()
    im = Image.open(io.BytesIO(base64.b64decode(data.split(",")[1]))).convert("RGBA")
    im.save(OUT / "front-blank.webp", quality=86, method=6)
    im.save(OUT / "front-blank.avif", quality=70)
    print(json.dumps(info))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:3000")
    ap.add_argument("--chrome", default=None)
    a = ap.parse_args()
    asyncio.run(main(a.url, a.chrome))
