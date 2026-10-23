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

/**
 * The screen glass in the first-paint image (front-blank.*, a still of the 3D
 * character baked with scripts/bake_still.py), corners clockwise from top-left.
 */
export const SCREEN_QUAD: [number, number][] = [
  [476, 209],
  [931, 224],
  [921, 650],
  [467, 644],
];

/** The five LEDs under the screen in the first-paint image. */
export const LEDS: [number, number][] = [
  [812, 715],
  [837, 715],
  [862, 716],
  [886, 716],
  [911, 716],
];

/**
 * The 3D canvas covers the box plus these margins (fractions of the box), so turns never clip
 * and the sweater can run past the bottom of the box on tall phones.
 */
export const CANVAS = { side: 0.18, top: 0.16, bottom: 0.4 };

/** Neck top: the head turns around this point. */
export const PIVOT = { x: 656, y: 772 };

/** Neck span in the photo, and the row it disappears into the turtleneck. */
export const NECK = { left: 541, right: 772, bottom: 905 };

/** The torso turns around this point (middle of the chest). */
export const TORSO_PIVOT = { x: 656, y: 1150 };
