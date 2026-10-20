/**
 * CSS matrix3d that maps a w×h element onto an arbitrary quad (clockwise from
 * top-left). Used to lay the live screen canvas over the photo's tilted screen.
 */
export function quadToMatrix3d(w: number, h: number, q: [number, number][]): string {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  // unit square -> quad (Heckbert)
  const dx1 = x1 - x2,
    dx2 = x3 - x2,
    sx = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2,
    dy2 = y3 - y2,
    sy = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / det;
  const hh = (dx1 * sy - sx * dy1) / det;
  const a = x1 - x0 + g * x1,
    b = x3 - x0 + hh * x3,
    c = x0;
  const d = y1 - y0 + g * y1,
    e = y3 - y0 + hh * y3,
    f = y0;
  // compose with the w×h -> unit square scale
  const m = [a / w, b / h, c, d / w, e / h, f, g / w, hh / h, 1];
  // 3x3 [m0 m1 m2; m3 m4 m5; m6 m7 m8] -> column-major 4x4
  const M = [m[0], m[3], 0, m[6], m[1], m[4], 0, m[7], 0, 0, 1, 0, m[2], m[5], 0, m[8]];
  return `matrix3d(${M.map((v) => +v.toFixed(8)).join(",")})`;
}
