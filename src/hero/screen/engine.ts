import { T } from "../timings";

/**
 * The monitor's screen. Draws everything live onto a 2D canvas that the 3D
 * monitor uses as a texture and the no-WebGL fallback lays over the photo.
 * Nothing on the screen is ever baked into an image.
 */

type Mode = "text" | "boot" | "face";

const W = 640;
const H = 620;
const PHOSPHOR = "#e6ecff";
const GLOW = "rgba(120,160,255,0.65)";
const FONT = "VT323";

// pixel-art glyphs for the face (1 = lit)
const EYE_HAPPY = ["..#..", ".#.#.", "#...#"];
const EYE_BLINK = [".....", ".....", "#####"];
const MOUTH_SMILE = ["#.......#", ".#.....#.", "..#####.."];
const MOUTH_TALK = ["..#####..", ".#.....#.", "..#####.."];
const MOUTH_TALK_SMALL = [".........", "..#####..", "........."];

type Star = { x: number; y: number; z: number; tw: number };

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
  private talking = false;
  private nextBlink = 0;
  private blinkUntil = 0;
  private stars: Star[];
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

  /** Steady text, e.g. "[CLICK] TO START_". A trailing "_" blinks as a caret. */
  showText(text: string, now = performance.now()) {
    this.mode = "text";
    this.text = text;
    this.modeAt = now;
  }

  /** Quick CRT flicker, then the new text. */
  flickerTo(text: string, now = performance.now()) {
    this.showText(text, now);
    if (!this.reducedMotion) this.flickerUntil = now + T.nudgeFlicker;
  }

  /** Scan-line power-on flash, then a short boot line. */
  powerOn(bootText: string, now = performance.now()) {
    this.mode = "boot";
    this.bootText = bootText;
    this.modeAt = now;
  }

  showFace(now = performance.now()) {
    this.mode = "face";
    this.modeAt = now;
    this.scheduleBlink(now);
  }

  setTalking(on: boolean) {
    this.talking = on;
  }

  private scheduleBlink(now: number) {
    this.nextBlink = now + T.blinkMin + Math.random() * (T.blinkMax - T.blinkMin);
  }

  /** Draw a frame. Throttled to ~30fps; returns true when the canvas changed. */
  draw(now = performance.now()): boolean {
    if (now - this.last < 33) return false;
    this.last = now;
    const c = this.ctx;

    // background: deep CRT black with a faint centre bloom
    const g = c.createRadialGradient(W / 2, H * 0.45, 20, W / 2, H / 2, W * 0.75);
    g.addColorStop(0, "#0f1424");
    g.addColorStop(1, "#04050a");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    const since = now - this.modeAt;
    let brightness = 1;

    if (this.mode === "boot" && since < T.powerOn && !this.reducedMotion) {
      this.drawPowerOn(since / T.powerOn);
      this.finish(1);
      return true;
    }

    if (this.mode !== "face") this.drawStars(now);

    if (now < this.flickerUntil) {
      const step = Math.floor((this.flickerUntil - now) / (T.nudgeFlicker / 3));
      brightness = [0.25, 1.35, 0.5, 1][step % 4];
    }

    if (this.mode === "text") this.drawText(now, brightness);
    else if (this.mode === "boot") this.drawBootLine(now);
    else this.drawFace(now);

    this.finish(brightness);
    return true;
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
    const size = Math.round(H * 0.075);
    this.setFont(size);
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
    const size = Math.round(H * 0.075);
    this.setFont(size);
    const since = now - this.modeAt - T.powerOn;
    const chars = this.reducedMotion ? this.bootText.length : Math.max(0, Math.floor(since / 22));
    const shown = this.bootText.slice(0, chars);
    const x = W * 0.08;
    const y = H * 0.5;
    this.glowText("> " + shown, x, y);
    if (Math.floor(now / 200) % 2 === 0) {
      const w = c.measureText("> " + shown).width;
      this.glowText("_", x + w, y);
    }
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

  private drawGlyph(rows: string[], cx: number, cy: number, px: number) {
    const c = this.ctx;
    const w = rows[0].length * px;
    const h = rows.length * px;
    const x0 = Math.round(cx - w / 2);
    const y0 = Math.round(cy - h / 2);
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        if (row[i] === "#") c.fillRect(x0 + i * px, y0 + j * px, px - 2, px - 2);
      }
    });
  }

  private drawFace(now: number) {
    const c = this.ctx;
    if (!this.reducedMotion && now > this.nextBlink) {
      this.blinkUntil = now + T.blinkFor;
      this.scheduleBlink(now);
    }
    const blinking = now < this.blinkUntil;
    const px = 22;
    const eyes = blinking ? EYE_BLINK : EYE_HAPPY;
    let mouth = MOUTH_SMILE;
    if (this.talking && !this.reducedMotion) {
      const f = Math.floor(now / T.talkFrame) % 3;
      mouth = f === 0 ? MOUTH_TALK : f === 1 ? MOUTH_TALK_SMALL : MOUTH_SMILE;
    }
    // gentle fade-in when the face first appears
    const fade = this.reducedMotion ? 1 : Math.min(1, (now - this.modeAt) / 220);
    c.save();
    c.globalAlpha = fade;
    c.shadowColor = GLOW;
    c.shadowBlur = 18;
    c.fillStyle = PHOSPHOR;
    this.drawGlyph(eyes, W * 0.33, H * 0.4, px);
    this.drawGlyph(eyes, W * 0.67, H * 0.4, px);
    this.drawGlyph(mouth, W * 0.5, H * 0.66, px);
    // cheeks
    c.shadowBlur = 0;
    c.fillStyle = "rgba(120,150,255,0.35)";
    this.drawGlyph(["##"], W * 0.2, H * 0.55, px);
    this.drawGlyph(["##"], W * 0.8, H * 0.55, px);
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
