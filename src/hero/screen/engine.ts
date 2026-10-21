import { T } from "../timings";

/**
 * The monitor's screen. Draws everything live onto a 2D canvas that the 3D
 * monitor uses as a texture and the no-WebGL fallback lays over the photo.
 * Nothing on the screen is ever baked into an image.
 *
 * Modes: text (with blinking caret), image (a short CRT "broadcast" of a
 * picture), boot (power-on), eyes (the talking face).
 */

type Mode = "text" | "image" | "boot" | "eyes";

const W = 640;
const H = 620;
const PHOSPHOR = "#e6ecff";
const GLOW = "rgba(120,160,255,0.65)";
const FONT = "VT323";
/** Duotone colours an image pop is broadcast in. */
const TINTS = ["#ff4b2b", "#3f7dff", "#2fe08a", "#ffb02e"];

// pixel art, drawn white on black and then tinted like a photo
const PIXEL_ART: Record<string, string[]> = {
  heart: [
    ".##...##.",
    "####.####",
    "#########",
    "#########",
    ".#######.",
    "..#####..",
    "...###...",
    "....#....",
  ],
  bulb: [
    "...###...",
    "..#...#..",
    ".#.....#.",
    ".#..#..#.",
    ".#..#..#.",
    "..#.#.#..",
    "...###...",
    "...###...",
    "....#....",
  ],
  spark: ["....#....", "....#....", "...###...", "#########", "...###...", "....#....", "....#...."],
  hi: ["#...#.###", "#...#..#.", "#####..#.", "#...#..#.", "#...#.###"],
};

type Pic = { gray: HTMLCanvasElement | null; tinted: Map<string, HTMLCanvasElement> };
type Pop = { pic: Pic; tint: string; start: number; dur: number; returnTo: string };

export class ScreenEngine {
  readonly canvas: HTMLCanvasElement;
  readonly width = W;
  readonly height = H;
  private ctx: CanvasRenderingContext2D;
  private mode: Mode = "text";
  private text = "";
  private modeAt = 0;
  private flickerUntil = 0;
  private bootText = "";
  private caption = "";
  private captionAt = 0;
  private slipUntil = 0;
  private talking = false;
  private nextBlink = 0;
  private blinkAt = -1e9;
  private nextTwinkle = 0;
  private twinkleAt = -1e9;
  private twinkleEye = 0;
  private gaze = { x: 0, y: 0 };
  private pics: Pic[] = [];
  private picIndex = 0;
  private tintIndex = 0;
  private pop: Pop | null = null;
  private glitchSeed = 0;
  private glitchAt = 0;
  private stars: { x: number; y: number; z: number; tw: number }[];
  private last = 0;
  private fontReady = false;
  reducedMotion = false;
  /** Bumps every time the picture changes; consumers re-upload the texture on change. */
  version = 0;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext("2d")!;
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    this.stars = Array.from({ length: 70 }, () => ({
      x: rnd() * W,
      y: rnd() * H,
      z: 0.3 + rnd() * 0.7,
      tw: rnd() * Math.PI * 2,
    }));
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.load(`40px ${FONT}`).then(() => {
        this.fontReady = true;
      });
    }
  }

  // ---------------------------------------------------------------- public

  /** Pictures for the idle pops: image URLs, or "pixel:heart" style built-ins. */
  loadImages(sources: string[]) {
    this.pics = sources.map((src) => {
      const pic: Pic = { gray: null, tinted: new Map() };
      if (src.startsWith("pixel:")) {
        pic.gray = pixelArt(PIXEL_ART[src.slice(6)] ?? PIXEL_ART.heart);
      } else {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => (pic.gray = toGray(img));
        img.src = src;
      }
      return pic;
    });
  }

  /** Steady text, e.g. "[CLICK] TO START_". A trailing "_" blinks as a caret. */
  showText(text: string, now = performance.now()) {
    this.mode = "text";
    this.text = text;
    this.modeAt = now;
    this.pop = null;
  }

  /** Quick CRT flicker, then the new text. */
  flickerTo(text: string, now = performance.now()) {
    this.showText(text, now);
    if (!this.reducedMotion) this.flickerUntil = now + T.nudgeFlicker;
  }

  /** Broadcast the next picture for a few seconds, then go back to the current text. */
  popImage(now = performance.now()): boolean {
    const ready = this.pics.filter((p) => p.gray);
    if (!ready.length || this.reducedMotion) return false;
    const pic = ready[this.picIndex++ % ready.length];
    const tint = TINTS[this.tintIndex++ % TINTS.length];
    this.pop = { pic, tint, start: now, dur: T.imagePop, returnTo: this.mode === "text" ? this.text : "" };
    this.mode = "image";
    this.modeAt = now;
    return true;
  }

  /** Scan-line power-on flash, then a short boot line. */
  powerOn(bootText: string, now = performance.now()) {
    this.mode = "boot";
    this.bootText = bootText;
    this.modeAt = now;
    this.pop = null;
  }

  showFace(now = performance.now()) {
    this.mode = "eyes";
    this.modeAt = now;
    this.scheduleBlink(now);
    this.nextTwinkle = now + 1800 + Math.random() * 2500;
  }

  setTalking(on: boolean) {
    this.talking = on;
  }

  /** Small terminal caption under the eyes, e.g. "HELLO, HUMAN_". Types itself in. */
  setCaption(text: string, now = performance.now()) {
    if (text === this.caption) return;
    this.caption = text;
    this.captionAt = now;
  }

  /** The machine slips: the picture tears and flickers for a moment. */
  glitch(ms = 420, now = performance.now()) {
    if (this.reducedMotion) return;
    this.slipUntil = now + ms;
    this.flickerUntil = now + Math.min(ms, 260);
  }

  /** Where the eyes look, -1..1 on each axis. */
  setGaze(x: number, y: number) {
    this.gaze.x = Math.max(-1, Math.min(1, x));
    this.gaze.y = Math.max(-1, Math.min(1, y));
  }

  /** Draw a frame. Throttled to ~30fps; returns true when the canvas changed. */
  draw(now = performance.now()): boolean {
    if (now - this.last < 33) return false;
    this.last = now;
    const c = this.ctx;

    const since = now - this.modeAt;
    let brightness = 1;

    if (this.mode === "boot" && since < T.powerOn && !this.reducedMotion) {
      this.background();
      this.drawPowerOn(since / T.powerOn);
      this.finish(1);
      return true;
    }

    if (this.mode === "image" && this.pop && since >= this.pop.dur) {
      const back = this.pop.returnTo;
      this.showText(back || this.text, now);
      this.flickerUntil = now + T.nudgeFlicker;
    }

    if (now < this.flickerUntil) {
      const step = Math.floor((this.flickerUntil - now) / (T.nudgeFlicker / 3));
      brightness = [0.25, 1.35, 0.5, 1][step % 4];
    }

    if (this.mode === "image" && this.pop) {
      this.drawImagePop(now, this.pop);
      this.finish(1);
      return true;
    }

    this.background();
    if (this.mode === "text") {
      this.drawStars(now);
      this.drawText(now, brightness);
    } else if (this.mode === "boot") {
      this.drawStars(now);
      this.drawBootLine(now);
    } else {
      this.drawEyes(now);
      this.drawCaption(now);
      if (now < this.slipUntil) this.drawTear();
    }
    this.finish(brightness);
    void c;
    return true;
  }

  // ---------------------------------------------------------------- pieces

  private scheduleBlink(now: number) {
    this.nextBlink = now + T.blinkMin + Math.random() * (T.blinkMax - T.blinkMin);
  }

  private background() {
    const c = this.ctx;
    const g = c.createRadialGradient(W / 2, H * 0.45, 20, W / 2, H / 2, W * 0.75);
    g.addColorStop(0, "#0f1424");
    g.addColorStop(1, "#04050a");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }

  private drawStars(now: number) {
    const c = this.ctx;
    const t = this.reducedMotion ? 0 : now / 1000;
    for (const s of this.stars) {
      const x = (((s.x - t * 6 * s.z) % W) + W) % W;
      const y = (((s.y + t * 2 * s.z) % H) + H) % H;
      const a = 0.12 + 0.3 * s.z * (0.6 + 0.4 * Math.sin(t * 1.7 + s.tw));
      c.fillStyle = `rgba(210,222,255,${a.toFixed(3)})`;
      const r = s.z > 0.85 ? 2 : 1.4;
      c.fillRect(x, y, r, r);
    }
  }

  private noise(count: number, alpha: number) {
    const c = this.ctx;
    for (let i = 0; i < count; i++) {
      const v = 120 + Math.random() * 135;
      c.fillStyle = `rgba(${v},${v},${v},${(alpha * Math.random()).toFixed(3)})`;
      c.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
  }

  private setFont(px: number) {
    this.ctx.font = `${px}px ${this.fontReady ? FONT : "monospace"}`;
  }

  private glowText(text: string, x: number, y: number, alpha = 1) {
    const c = this.ctx;
    c.save();
    c.globalAlpha = alpha;
    c.shadowColor = GLOW;
    c.shadowBlur = 14;
    c.fillStyle = PHOSPHOR;
    c.fillText(text, x, y);
    c.shadowBlur = 0;
    c.fillText(text, x, y);
    c.restore();
  }

  private drawText(now: number, brightness: number) {
    const c = this.ctx;
    this.setFont(Math.round(H * 0.075));
    c.textBaseline = "alphabetic";
    const caretOn = this.reducedMotion || Math.floor(now / 530) % 2 === 0;
    const hasCaret = this.text.endsWith("_");
    const body = hasCaret ? this.text.slice(0, -1) : this.text;
    const x = W * 0.08;
    const y = H * 0.86;
    const jitter = now < this.flickerUntil ? (Math.random() - 0.5) * 8 : 0;
    this.glowText(body, x + jitter, y, Math.min(1, brightness));
    if (hasCaret && caretOn) {
      const w = c.measureText(body).width;
      this.glowText("_", x + jitter + w, y, Math.min(1, brightness));
    }
  }

  private drawBootLine(now: number) {
    const c = this.ctx;
    this.setFont(Math.round(H * 0.075));
    const since = now - this.modeAt - T.powerOn;
    const chars = this.reducedMotion ? this.bootText.length : Math.max(0, Math.floor(since / 22));
    const shown = "> " + this.bootText.slice(0, chars);
    const x = W * 0.08;
    const y = H * 0.5;
    this.glowText(shown, x, y);
    if (Math.floor(now / 200) % 2 === 0) this.glowText("_", x + c.measureText(shown).width, y);
  }

  private drawCaption(now: number) {
    if (!this.caption) return;
    const c = this.ctx;
    this.setFont(Math.round(H * 0.062));
    c.textBaseline = "alphabetic";
    const hasCaret = this.caption.endsWith("_");
    const body = hasCaret ? this.caption.slice(0, -1) : this.caption;
    const chars = this.reducedMotion ? body.length : Math.floor((now - this.captionAt) / 40);
    const shown = "> " + body.slice(0, chars);
    const x = W * 0.07;
    const y = H * 0.84;
    this.glowText(shown, x, y, 0.92);
    const caretOn = this.reducedMotion || Math.floor(now / 530) % 2 === 0;
    if ((hasCaret || chars < body.length) && caretOn) {
      this.glowText("_", x + c.measureText(shown).width, y, 0.92);
    }
  }

  /** Horizontal tears: slices of the frame shoved sideways, with a colour fringe. */
  private drawTear() {
    const c = this.ctx;
    const bands = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < bands; i++) {
      const y = Math.random() * H;
      const h = 6 + Math.random() * 26;
      const off = (Math.random() - 0.5) * 70;
      c.drawImage(this.canvas, 0, y, W, h, off, y, W, h);
      c.fillStyle = Math.random() > 0.5 ? "rgba(255,70,90,0.18)" : "rgba(60,170,255,0.18)";
      c.fillRect(0, y, W, h * 0.4);
    }
    this.noise(500, 0.5);
  }

  private drawPowerOn(p: number) {
    const c = this.ctx;
    c.fillStyle = "#000";
    c.fillRect(0, 0, W, H);
    // a bright line grows across, then opens vertically and fades
    const lineW = Math.min(1, p / 0.35) * W;
    const open = p < 0.35 ? 3 : 3 + ((p - 0.35) / 0.65) * H;
    const a = p < 0.35 ? 1 : 1 - (p - 0.35) / 0.65;
    c.fillStyle = `rgba(235,242,255,${a})`;
    c.shadowColor = GLOW;
    c.shadowBlur = 30;
    c.fillRect((W - lineW) / 2, H / 2 - open / 2, lineW, open);
    c.shadowBlur = 0;
  }

  /** A picture broadcast on a bad channel: duotone, torn lines, colour fringes, rolling bar, static. */
  private drawImagePop(now: number, pop: Pop) {
    const c = this.ctx;
    const t = now - pop.start;
    const edge = Math.min(t, pop.dur - t);
    const burst = edge < 260; // static on the way in and out
    const src = tinted(pop.pic, pop.tint);

    c.fillStyle = "#030305";
    c.fillRect(0, 0, W, H);
    if (!src) return;

    // pick new tear lines every ~90ms
    if (now - this.glitchAt > 90) {
      this.glitchAt = now;
      this.glitchSeed = Math.random() * 1000;
    }
    const roll = burst ? (Math.random() - 0.5) * 60 : 0;
    const band = 10;
    c.save();
    c.globalAlpha = burst ? 0.35 + Math.random() * 0.5 : 0.82 + Math.random() * 0.12;
    for (let y = 0; y < H; y += band) {
      const n = Math.sin(y * 12.9898 + this.glitchSeed) * 43758.5453;
      const r = n - Math.floor(n);
      let off = Math.sin(y * 0.045 + now * 0.004) * 3;
      if (r > (burst ? 0.55 : 0.93)) off += (r - 0.5) * (burst ? 140 : 70);
      c.drawImage(src, 0, y, W, band, off, y + roll, W, band);
    }
    // colour fringe
    c.globalCompositeOperation = "screen";
    c.globalAlpha = 0.28;
    c.drawImage(src, 6, roll);
    c.globalAlpha = 0.18;
    c.drawImage(src, -5, roll + 1);
    c.restore();

    // rolling bright bar
    const barY = ((now * 0.22) % (H + 120)) - 60;
    const bar = c.createLinearGradient(0, barY - 60, 0, barY + 60);
    bar.addColorStop(0, "rgba(255,255,255,0)");
    bar.addColorStop(0.5, "rgba(255,255,255,0.09)");
    bar.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = bar;
    c.fillRect(0, barY - 60, W, 120);

    this.noise(burst ? 2200 : 320, burst ? 0.9 : 0.35);
  }

  /** Two glowing round eyes that blink, follow the cursor and pulse while talking. */
  private drawEyes(now: number) {
    const c = this.ctx;
    // faint static behind the eyes, like a live tube
    if (!this.reducedMotion) this.noise(260, 0.22);

    if (!this.reducedMotion && now > this.nextBlink) {
      this.blinkAt = now;
      this.scheduleBlink(now);
      // now and then, a quick double blink
      if (Math.random() < 0.3) this.nextBlink = now + T.blinkFor * 1.6 + 110;
    }
    if (!this.reducedMotion && now > this.nextTwinkle) {
      this.twinkleAt = now;
      this.twinkleEye = Math.random() < 0.5 ? 0 : 1;
      this.nextTwinkle = now + T.twinkleMin + Math.random() * (T.twinkleMax - T.twinkleMin);
    }
    const bt = now - this.blinkAt;
    const blinkDur = T.blinkFor * 1.6;
    const open = bt < blinkDur ? 1 - Math.sin((bt / blinkDur) * Math.PI) * 0.94 : 1;

    // talking: a smooth, speech-like wobble in size and brightness
    let talk = 0;
    if (this.talking && !this.reducedMotion) {
      const s = now / 1000;
      talk = Math.abs(Math.sin(s * 11.3) * 0.6 + Math.sin(s * 17.9 + 1.3) * 0.4);
    }
    const fade = this.reducedMotion ? 1 : Math.min(1, (now - this.modeAt) / 260);
    const r = W * 0.125 * (1 + talk * 0.09);
    const gx = this.gaze.x * W * 0.07;
    const gy = this.gaze.y * H * 0.06 - talk * 5;
    const cy = H * 0.46;
    c.save();
    c.globalAlpha = fade * (0.92 + talk * 0.08);
    this.eye(W * 0.3 + gx, cy + gy, r, open);
    this.eye(W * 0.7 + gx, cy + gy, r, open);
    c.restore();

    // a twinkle: a small four-point glint that blooms on one eye and fades
    const tt = (now - this.twinkleAt) / T.twinkleFor;
    if (tt >= 0 && tt < 1 && open > 0.6) {
      const ex = (this.twinkleEye ? W * 0.7 : W * 0.3) + gx + r * 0.42;
      const ey = cy + gy - r * 0.48;
      this.sparkle(ex, ey, r * 0.55 * Math.sin(tt * Math.PI), Math.sin(tt * Math.PI));
    }
  }

  private sparkle(x: number, y: number, size: number, alpha: number) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.globalAlpha = alpha;
    c.shadowColor = "rgba(200,220,255,0.9)";
    c.shadowBlur = 18;
    c.fillStyle = "#ffffff";
    c.beginPath();
    const w = size * 0.16;
    c.moveTo(0, -size);
    c.quadraticCurveTo(w, -w, size, 0);
    c.quadraticCurveTo(w, w, 0, size);
    c.quadraticCurveTo(-w, w, -size, 0);
    c.quadraticCurveTo(-w, -w, 0, -size);
    c.fill();
    c.restore();
  }

  private eye(x: number, y: number, r: number, open: number) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.scale(1, Math.max(0.06, open));
    // wide soft halo
    const halo = c.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2.1);
    halo.addColorStop(0, "rgba(170,200,255,0.35)");
    halo.addColorStop(1, "rgba(170,200,255,0)");
    c.fillStyle = halo;
    c.beginPath();
    c.arc(0, 0, r * 2.1, 0, Math.PI * 2);
    c.fill();
    // warm and cool fringes, like a slightly mis-converged tube
    c.globalCompositeOperation = "lighter";
    c.fillStyle = "rgba(255,120,60,0.45)";
    c.beginPath();
    c.arc(r * 0.07, r * 0.02, r, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(70,150,255,0.5)";
    c.beginPath();
    c.arc(-r * 0.07, -r * 0.02, r, 0, Math.PI * 2);
    c.fill();
    // hot core
    c.globalCompositeOperation = "source-over";
    const core = c.createRadialGradient(0, 0, 0, 0, 0, r);
    core.addColorStop(0, "rgba(255,255,255,1)");
    core.addColorStop(0.72, "rgba(240,244,255,0.97)");
    core.addColorStop(1, "rgba(210,225,255,0)");
    c.fillStyle = core;
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  private finish(brightness: number) {
    const c = this.ctx;
    // scan lines
    c.fillStyle = "rgba(0,0,0,0.22)";
    for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 2);
    // vignette into the bezel
    const v = c.createRadialGradient(W / 2, H / 2, W * 0.35, W / 2, H / 2, W * 0.78);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.75)");
    c.fillStyle = v;
    c.fillRect(0, 0, W, H);
    // soft glass sheen, top-left
    const sh = c.createLinearGradient(0, 0, W * 0.6, H * 0.5);
    sh.addColorStop(0, "rgba(255,255,255,0.07)");
    sh.addColorStop(0.5, "rgba(255,255,255,0.015)");
    sh.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = sh;
    c.fillRect(0, 0, W, H);
    if (brightness > 1) {
      c.fillStyle = `rgba(200,215,255,${(brightness - 1) * 0.3})`;
      c.fillRect(0, 0, W, H);
    } else if (brightness < 1) {
      c.fillStyle = `rgba(0,0,0,${1 - brightness})`;
      c.fillRect(0, 0, W, H);
    }
    this.version++;
  }
}

// ------------------------------------------------------------------ helpers

function blank() {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  return c;
}

/** Fit an image to the screen (cover), grayscale it with a punchy contrast curve. */
function toGray(img: HTMLImageElement) {
  const c = blank();
  const x = c.getContext("2d", { willReadFrequently: true })!;
  const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const w = img.naturalWidth * s;
  const h = img.naturalHeight * s;
  x.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  const d = x.getImageData(0, 0, W, H);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const l = (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]) / 255;
    const v = Math.round(255 * Math.min(1, Math.max(0, (l - 0.12) * 1.35)) ** 1.15);
    p[i] = p[i + 1] = p[i + 2] = v;
  }
  x.putImageData(d, 0, 0);
  return c;
}

function pixelArt(rows: string[]) {
  const c = blank();
  const x = c.getContext("2d")!;
  x.fillStyle = "#000";
  x.fillRect(0, 0, W, H);
  const px = Math.floor(Math.min((W * 0.6) / rows[0].length, (H * 0.6) / rows.length));
  const x0 = (W - rows[0].length * px) / 2;
  const y0 = (H - rows.length * px) / 2;
  x.fillStyle = "#fff";
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++)
      if (row[i] === "#") x.fillRect(x0 + i * px, y0 + j * px, px - 4, px - 4);
  });
  return c;
}

/** Duotone: black stays black, white becomes the tint, highlights bloom toward white. */
function tinted(pic: Pic, tint: string) {
  if (!pic.gray) return null;
  let t = pic.tinted.get(tint);
  if (!t) {
    t = blank();
    const x = t.getContext("2d")!;
    x.drawImage(pic.gray, 0, 0);
    x.globalCompositeOperation = "multiply";
    x.fillStyle = tint;
    x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = "screen";
    x.globalAlpha = 0.22;
    x.drawImage(pic.gray, 0, 0);
    pic.tinted.set(tint, t);
  }
  return t;
}
