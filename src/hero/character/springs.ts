/** Plain-number motion helpers (no three.js, safe for the first-paint bundle). */

export type Spring = { x: number; v: number };

/**
 * Damped spring toward `target`, integrated over `dt` seconds in small steps,
 * so the result does not depend on the frame rate. zeta < 1 overshoots a little.
 */
export function spring(s: Spring, target: number, omega: number, zeta: number, dt: number) {
  const n = Math.max(1, Math.ceil(dt * 240));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const a = omega * omega * (target - s.x) - 2 * zeta * omega * s.v;
    s.v += a * h;
    s.x += s.v * h;
  }
}

/** Exponential approach, frame-rate independent (λ in 1/s). */
export const damp = (x: number, target: number, lambda: number, dt: number) =>
  x + (target - x) * (1 - Math.exp(-lambda * dt));

/** Soft limit: linear near zero, easing into ±max, never a hard stop. */
export const soft = (x: number, max: number) => max * Math.tanh(x / max);
