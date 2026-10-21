import type { ScreenEngine } from "../screen/engine";

/**
 * Live controls for the head, written by the hero every pointer move and read
 * by the renderer every frame. A plain mutable object, so moving the mouse
 * never re-renders React.
 */
export type HeadControl = {
  /** Target angles in degrees. Positive yaw looks right, positive pitch looks down. */
  yaw: number;
  pitch: number;
  /** Target head tilt in degrees; positive raises the right side. */
  roll: number;
  /** The pose's built-in turn: the eyes on the screen look relative to it. */
  yawBias: number;
  /** Torso scale; the head keeps its size. 1 = as photographed. */
  body: number;
  /** performance.now() of the latest nod. */
  nodAt: number;
  /** Reduced motion: jump straight to the target pose, no lag, no nods. */
  frozen: boolean;
};

export type RendererProps = {
  engine: ScreenEngine;
  head: HeadControl;
  /** Index of the lit LED (0–4). */
  led: number;
  paused: boolean;
  onReady: () => void;
};
