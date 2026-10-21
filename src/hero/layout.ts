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
  // stays big, like State 1, and steps to the right of the conversation
  const idle = idleBox(vw, vh);
  const s = idle.s * 0.96;
  return { box: place(s, vw * 0.67, vh * 0.47), columnTop: 0 };
}
