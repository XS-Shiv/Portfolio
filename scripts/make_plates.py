"""Build the transparent image plates the hero uses from public/character/front.png.

Outputs (in public/character/):
  body.webp/.avif   sweater only (neck and the photo's cords removed: the 3D scene draws them),
                   transparent, extended downwards

front-blank.* (the first paint and the no-WebGL fallback) is no longer cut from the
photo: it is a still of the 3D character, baked by scripts/bake_still.py, so the
first paint matches the live head exactly.

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


# The cords lying over the left of the collar in the photo, traced in body-plate pixels.
CORDS = [
    [(420, 298), (424, 330), (440, 355), (470, 375), (500, 382), (530, 375), (555, 352), (575, 320), (585, 290), (588, 258)],
    [(392, 305), (400, 340), (412, 370), (435, 395), (470, 420), (505, 432), (540, 428), (570, 410), (592, 380),
     (600, 340), (602, 300), (602, 258)],
    [(386, 306), (392, 345), (398, 380), (410, 412), (430, 440), (458, 460), (490, 470), (520, 463), (545, 446), (556, 430)],
    [(552, 250), (555, 290), (558, 330), (560, 380), (562, 425)],
    [(372, 312), (385, 318), (398, 330), (410, 345)],
]


def remove_cables(img):
    """The 3D scene draws its own cords, plugged in at both ends, so the photo's cords are painted
    out with the mirrored right half of the sweater (the knit is close to symmetric there)."""
    a = np.asarray(img).astype(float)
    alpha = a[..., 3]
    h, w = alpha.shape
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    for cord in CORDS:
        d.line(cord, fill=255, width=22, joint="curve")
        for x, y in cord:
            d.ellipse((x - 11, y - 11, x + 11, y + 11), fill=255)
    core = np.asarray(m) > 0
    soft = np.maximum(core.astype(float), ndi.gaussian_filter(ndi.binary_dilation(core, structure=disk(3)).astype(float), 2.0))
    xs = np.clip(np.round(2 * NECK_C - np.arange(w)).astype(int), 0, w - 1)
    mir = a[:, xs].copy()
    # where the mirrored spot is off the sweater (the right shoulder sits lower), borrow knit from below
    below = np.roll(a, -160, axis=0)
    off = mir[..., 3] < 200
    mir[off] = below[off]
    # match the local brightness of the knit around each cord, so no band shows
    lum = a[..., :3].mean(2)
    keep = (~core) & (alpha > 200)
    g = lambda x: ndi.gaussian_filter(x, 14)
    around = g(lum * keep) / np.maximum(g(keep.astype(float)), 1e-3)
    fill = g(mir[..., :3].mean(2))
    mir[..., :3] *= np.clip(around / np.maximum(fill, 1e-3), 0.6, 1.6)[..., None]
    rgb = a[..., :3] * (1 - soft[..., None]) + mir[..., :3] * soft[..., None]
    # the cords' thin see-through edges fill in, and where they stuck out past the shoulder's
    # outline, the outline closes over them
    cleaned = ndi.grey_closing(ndi.grey_opening(alpha, footprint=disk(7)), footprint=disk(7))
    alpha = alpha * (1 - soft) + cleaned * soft
    out = np.dstack([rgb, alpha])
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")


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
    body = remove_cables(body_plate(src, full_alpha))
    for img, name in ((body, "body"),):
        img.save(OUT / f"{name}.webp", quality=86, method=6)
        try:
            img.save(OUT / f"{name}.avif", quality=70)
        except Exception as e:  # pillow without AVIF support
            print("avif skipped:", e)
    print("body", body.size)


if __name__ == "__main__":
    main()
