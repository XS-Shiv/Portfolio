"""Build the transparent image plates the hero uses from public/character/front.png.

Outputs (in public/character/):
  body.webp/.avif   sweater only (neck removed: the 3D scene draws it), transparent, extended downwards
  front-blank.*    the whole character (monitor + body) with the screen blanked, transparent,
                   used as the first paint and as the no-WebGL fallback

Run: python3 scripts/make_plates.py   (needs pillow, numpy, scipy)
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public/character/front.png"
OUT = ROOT / "public/character"

BG = np.array([222.0, 222.0, 225.0])  # the photo's backdrop grey
PAD_B = 360                          # extension so the sweater reaches the bottom on tall phones
NECK_L, NECK_R = 545, 768            # neck span in front.png
NECK_C = (NECK_L + NECK_R) / 2
CUT_Y = 560                          # body plate starts here (monitor hides everything above)


def disk(r):
    y, x = np.ogrid[-r : r + 1, -r : r + 1]
    return x * x + y * y <= r * r


def decontaminate(rgb, alpha):
    a = np.clip(alpha, 1e-3, 1)[..., None]
    return np.clip((rgb - (1 - a) * BG) / a, 0, 255)


def neck_collar(src, xs):
    """Row where the turtleneck starts, per column (the skin's lowest pixel). Columns hidden by the
    plugs on the left are mirrored from the clean right half."""
    collar = np.zeros(len(xs))
    for i, x in enumerate(xs):
        sx = x if x >= 622 else int(round(2 * NECK_C - x))
        sx = int(min(max(sx, 622), NECK_R - 2))
        col = src[740:860, sx].astype(int)
        skin = [j for j, p in enumerate(col) if p[0] > p[2] + 15]
        collar[i] = 740 + (skin[-1] if skin else 60) + 2
    # the rim is a smooth curve: fit a parabola to the clean right half, symmetric about the neck
    clean = xs >= 622
    u = (xs[clean] - NECK_C) ** 2
    a, b = np.polyfit(u, collar[clean], 1)
    return a * (xs - NECK_C) ** 2 + b


def fair_skin(rgb, alpha, src):
    """Recolour the neck to a fair skin tone, keeping the photo's shading."""
    r, g, b = src[..., 0], src[..., 1], src[..., 2]
    skin = (r > b + 15) & (r > 40) & (alpha > 0.05)
    skin[:700] = False
    skin[880:] = False
    skin[:, :NECK_L - 10] = False
    skin[:, NECK_R + 10:] = False
    lum = src.mean(2)
    ref = np.percentile(lum[skin], 80)
    fair = np.array([240.0, 204.0, 180.0])
    shade = np.clip(lum / ref, 0, 1.15)[..., None] ** 0.8
    new = np.clip(fair * shade, 0, 255)
    soft = ndi.gaussian_filter(skin.astype(float), 1.0)[..., None]
    return rgb * (1 - soft) + new * soft


def body_plate(src, full_alpha):
    """Sweater + neck from the full cutout, monitor removed, extended downwards for tall phones."""
    h, w, _ = src.shape
    lum = src.mean(2)
    MON_Y = 772  # the monitor and its plugs end here; above it only the neck survives
    # dark pixels only: drops backdrop trapped between cables by the full cutout's hole fill
    alpha = full_alpha * np.clip((200 - lum) / 70, 0, 1)
    alpha[:MON_Y] = 0
    solid = ndi.binary_opening(alpha > 0.5, structure=disk(9))  # no cables over the backdrop
    lab, n = ndi.label(solid)
    sizes = ndi.sum(solid, lab, range(1, n + 1))
    solid = lab == (np.argmax(sizes) + 1)
    alpha = alpha * ndi.gaussian_filter(ndi.binary_dilation(solid, structure=disk(1)).astype(float), 0.7)
    rgb = decontaminate(src, alpha)
    navy = np.array([28.0, 31.0, 44.0])  # faint edge pixels: un-mixing is unstable, use the sweater colour
    t = np.clip(alpha / 0.35, 0, 1)[..., None]
    rgb = rgb * t + navy * (1 - t)

    # neck: removed. The 3D scene draws a bending neck behind the collar; only the collar stays.
    xs = np.arange(NECK_L - 4, NECK_R + 5)
    collar = neck_collar(src, xs)
    for i, x in enumerate(xs):
        c = int(collar[i])
        alpha[CUT_Y:c, x] = 0
        alpha[c:c + 3, x] *= np.array([0.35, 0.7, 1.0])[: len(alpha[c:c + 3, x])]

    # extend downwards: column shading stretched (knit ribs are vertical anyway) plus mirrored fine detail
    H = h + PAD_B
    R = np.zeros((H, w, 3)); A = np.zeros((H, w))
    R[:h] = rgb; A[:h] = alpha
    base = np.median(rgb[h - 8:h], axis=0)
    band = rgb[1080:h]
    detail = band - ndi.uniform_filter(band, size=(9, 9, 1))
    L = len(band)
    for k in range(PAD_B):
        m = k % (2 * L); m = m if m < L else 2 * L - 1 - m
        R[h + k] = (base + 0.8 * detail[L - 1 - m]) * (1 - 0.15 * k / PAD_B)
        A[h + k] = A[h - 1] * np.clip((PAD_B - k) / 160, 0, 1)
    rgba = np.dstack([np.clip(R, 0, 255), A * 255]).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA").crop((0, CUT_Y, w, H))


def front_blank(src):
    """Whole character, transparent background, blank screen."""
    h, w, _ = src.shape
    diff = np.abs(src - BG).max(2)
    sat = src.max(2) - src.min(2)
    bgish = (diff < 26) & (sat < 14) & (src.mean(2) > 196)
    lab, n = ndi.label(bgish)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    bg = ndi.binary_opening(bg, structure=disk(2))
    fgmask = ~bg
    fgmask = ndi.binary_fill_holes(fgmask)
    lab, n = ndi.label(fgmask)
    if n:
        sizes = ndi.sum(fgmask, lab, range(1, n + 1))
        fgmask = lab == (np.argmax(sizes) + 1)
    alpha = ndi.gaussian_filter(fgmask.astype(float), 0.8)
    rgb = decontaminate(src, alpha)

    # blank the screen: everything dark inside the glass becomes a deep CRT black
    screen = Image.new("L", (w, h), 0)
    ImageDraw.Draw(screen).rounded_rectangle((548, 208, 996, 642), radius=26, fill=255)
    sm = np.asarray(screen) > 0
    dark = src.mean(2) < 90
    m = sm & dark
    m = ndi.binary_closing(m, structure=disk(4))
    m = ndi.binary_fill_holes(m) & sm
    yy, xx = np.mgrid[0:h, 0:w]
    glow = np.clip(1 - np.hypot((xx - 770) / 300, (yy - 420) / 260), 0, 1)
    base = np.stack([8 + 10 * glow, 10 + 10 * glow, 14 + 12 * glow], -1)
    rgb[m] = base[m]
    rgb = fair_skin(rgb, alpha, src)
    rgba = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA"), alpha


def main():
    src = np.asarray(Image.open(SRC).convert("RGB")).astype(float)
    fb, full_alpha = front_blank(src)
    body = body_plate(src, full_alpha)
    for img, name in ((body, "body"), (fb, "front-blank")):
        img.save(OUT / f"{name}.webp", quality=86, method=6)
        try:
            img.save(OUT / f"{name}.avif", quality=70)
        except Exception as e:  # pillow without AVIF support
            print("avif skipped:", e)
    print("body", body.size, "front-blank", fb.size)


if __name__ == "__main__":
    main()
