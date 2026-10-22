import type { Box } from "./character/Character";
import { HEAD_CENTER, SRC } from "./character/geometry";

/** Phone layout below this width, or any portrait screen narrower than this ratio. */
export const isCompact = (vw: number, vh: number) => vw < 760 || vw / vh < 0.75;

const MONITOR_W = 680 / SRC; // monitor width as a fraction of the box
const MONITOR_H = 600 / SRC;

function place(s: number, cx: number, cy: number): Box {
  return { s, x: cx - (HEAD_CENTER.x / SRC) * s, y: cy - (HEAD_CENTER.y / SRC) * s };
}

/** Where the character box sits in State 1 (centre stage). */
export function idleBox(vw: number, vh: number): Box {
  if (isCompact(vw, vh)) {
    const s = Math.min((vw * 0.74) / MONITOR_W, (vh * 0.33) / MONITOR_H);
    return place(s, vw / 2, vh * 0.44);
  }
  const s = Math.min((vh * 0.5) / MONITOR_H, (vw * 0.42) / MONITOR_W);
  return place(s, vw / 2, vh * 0.46);
}

/** Where it sits in State 2, plus where the conversation column starts. */
export function talkBox(vw: number, vh: number): { box: Box; columnTop: number } {
  if (isCompact(vw, vh)) {
    const s = Math.min((vw * 0.5) / MONITOR_W, (vh * 0.22) / MONITOR_H);
    const inset = 20;
    const box = place(s, vw - inset - (s * MONITOR_W) / 2 + s * 0.02, Math.max(vh * 0.19, 64 + s * 0.24));
    // start the text just below the collar (source row ~900)
    const columnTop = Math.max(box.y + (900 / SRC) * s, vh * 0.36);
    return { box, columnTop };
  }
  // The machine is overpowering: same head-to-body proportions as State 1, but
  // a big head (about 62% of the screen's height), as large as the space between
  // the text column and the right edge allows. Its cables never reach the text.
  const inset = 40;
  const pad = inset + vw * 0.02; // matches the top bar's side padding
  const textEnd = pad + Math.min(vw * 0.34, 540) + 28; // the text column (see .column), plus a gap
  const buttonsStart = vw - pad - 236; // the sound and Let's talk buttons
  const reach = MONITOR_W + 0.1; // the monitor plus its cables looping out on the left
  const want = (vh * 0.62) / MONITOR_H;

  // Either it sits at the very top, beside the buttons...
  const besideButtons = Math.min(want, (buttonsStart - textEnd) / reach);
  // ...or, when the buttons would squeeze it, just below the top bar.
  const belowBar = Math.min((vh * 0.58) / MONITOR_H, (vw - pad - textEnd) / reach);
  const below = belowBar > besideButtons * 1.06;
  const s = below ? belowBar : besideButtons;
  const top = below ? 92 : vh * 0.025;
  const right = below ? vw - pad : buttonsStart;

  const lo = textEnd + s * (MONITOR_W / 2 + 0.1);
  const hi = right - (s * MONITOR_W) / 2;
  const cx = Math.min(Math.max(vw * 0.6, lo), Math.max(lo, hi));
  return { box: place(s, cx, top + (s * MONITOR_H) / 2), columnTop: 0 };
}
