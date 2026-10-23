import type { ScreenEngine } from "../screen/engine";

/**
 * Live controls for the head, written by the hero on pointer moves and read
 * by the renderer every frame. A plain mutable object, so moving the mouse
 * never re-renders React.
 */
export type HeadControl = {
  /** Where the head should look, degrees. Positive yaw looks right, positive pitch looks down. */
  yaw: number;
  pitch: number;
  /** The pose's built-in tilt in degrees; positive raises the right side. */
  roll: number;
  /** The pose's built-in turn: the eyes and the follow are relative to it. */
  yawBias: number;
  /** performance.now() of the latest pointer input; idle life starts after a while without one. */
  movedAt: number;
  /**
   * 0 while the pointer drives the head (the springs alone shape the motion).
   * > 0 eases the target itself at this rate (1/s): used when the cursor leaves
   * or a touch ends, so the head drifts back instead of snapping.
   */
  ease: number;
  /** performance.now() of the latest nod. */
  nodAt: number;
  /** Reduced motion: hold the target pose, no springs, no idle life. */
  frozen: boolean;
  /** Voice amplitude 0..1, for the face. */
  voice: number;
};

export type RendererProps = {
  engine: ScreenEngine;
  head: HeadControl;
  /** Index of the lit LED (0–4). */
  led: number;
  paused: boolean;
  onReady: () => void;
  /** Render the box only, posed and still, for baking the first-paint image (?still). */
  still?: boolean;
};
