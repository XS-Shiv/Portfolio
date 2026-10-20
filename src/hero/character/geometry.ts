/**
 * Shared coordinates. Everything is measured in pixels of the 1254×1254 source
 * photo (public/character/front.png), so the 3D head, the body plate and the
 * photo fallback all line up inside one square "character box".
 */
export const SRC = 1254;

/** Where the head sits in the photo (used to aim it at the pointer). */
export const HEAD_CENTER = { x: 700, y: 445 };

/** The body plate (body.webp) starts at this source row and is SRC wide. */
export const BODY_TOP = 560;
export const BODY_SIZE = { w: 1254, h: 1054 };

/** The screen glass in the photo, corners clockwise from top-left. */
export const SCREEN_QUAD: [number, number][] = [
  [543, 201],
  [998, 217],
  [993, 646],
  [540, 649],
];

/** The five LEDs under the screen in the photo. */
export const LEDS: [number, number][] = [
  [881, 698],
  [907, 701],
  [933, 703],
  [959, 703],
  [985, 705],
];

/** The 3D canvas covers the box plus this margin on every side, so turns never clip. */
export const CANVAS_MARGIN = 0.16;

/** Neck top: the head turns around this point. */
export const PIVOT = { x: 656, y: 772 };

/** Where the 3D cables meet the sweater (they continue as cables in the photo). */
export const CABLE_ENDS: [number, number][] = [
  [557, 803],
  [596, 832],
  [393, 869],
  [421, 858],
];
