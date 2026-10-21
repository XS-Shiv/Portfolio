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
  // The machine is overpowering: as big as the space between the text and the
  // top-right buttons allows, its top almost touching the top edge.
  const inset = 40;
  const pad = inset + vw * 0.02; // matches the top bar's side padding
  const textEnd = pad + Math.min(vw * 0.3, 480) + 24; // the text column, plus a gap
  const buttonsStart = vw - pad - 220; // the sound and Let's talk buttons
  const reach = MONITOR_W + 0.1; // the monitor plus its cables looping out on the left

  // (the 3D monitor draws about 40px below its box top, so these sit a little high)
  let s = Math.min((vh * 0.54) / MONITOR_H, (buttonsStart - textEnd) / reach);
  let top = vh * 0.05;
  // On narrower screens the buttons squeeze it; drop it just below the top bar
  // instead, where it can stay big.
  const below = Math.min((vh * 0.52) / MONITOR_H, (vw - pad - textEnd) / reach);
  if (below > s * 1.08) {
    s = below;
    top = 60;
  }
  const right = top < 56 ? buttonsStart : vw - pad;
  const lo = textEnd + s * (MONITOR_W / 2 + 0.1);
  const hi = right - (s * MONITOR_W) / 2;
  const cx = Math.min(Math.max(vw * 0.58, lo), Math.max(lo, hi));
  return { box: place(s, cx, top + (s * MONITOR_H) / 2), columnTop: 0 };
}
