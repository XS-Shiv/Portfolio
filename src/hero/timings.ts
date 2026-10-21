/**
 * Every timing in the hero, in milliseconds unless noted. Tweak here, nowhere else.
 * Values come from docs/design/hero-direction.md.
 */
export const T = {
  // State 1: idle
  nudgeMin: 5000, // something new on the screen every 5–7s without a start
  nudgeMax: 7000,
  nudgeFlicker: 160, // CRT flicker before each nudge
  imagePop: 2600, // how long a picture stays on the screen

  // Transition: booting
  powerOn: 280, // scan-line flash
  bootLineUntil: 700, // boot line visible from powerOn to here
  slideDelay: 200, // character starts sliding
  slide: 800, // character slide / scale / turn
  restartSlide: 700,
  firstLineAt: 700, // left column starts typing

  // Typing
  perChar: 26,
  punctuationPause: 160, // extra after . , ? !
  betweenLines: 350,
  pillStagger: 80,
  bodySpeed: 0.6, // body lines type at this share of the per-character delay
  cardPerChar: 14, // the three cards type together, this fast

  // The "I -> we" glitch
  slipAfter: 650, // pause after the line types, before it slips
  slipHold: 720, // how long the "we" frame stays up
  slipRetype: 0.7, // the recovery types this much faster than normal
  flipEveryMin: 6500, // once a step has settled, a word flips I <-> we every 6.5-11s
  flipEveryMax: 11000,
  flipHold: 650, // how long the flipped word stays

  // Screen face
  blinkMin: 2800,
  blinkMax: 5200,
  blinkFor: 120,
  talkFrame: 90,
  twinkleMin: 4500, // a glint on one eye every 4.5-9s
  twinkleMax: 9000,
  twinkleFor: 700,
  nod: 420,

  // Character
  breathePeriod: 4800,
} as const;

/** Head follow. */
export const HEAD = {
  maxYawDeg: 18,
  maxPitchDeg: 9, // looking down
  maxPitchUpDeg: 6, // looking up shows the neck, so a little less
  damping: 2.2, // exponential damping λ; ~450ms to 63% of the way, so it eases rather than snaps
  restYawDeg: 16, // no pointer yet: slightly turned, like the photo
  restPitchDeg: 3,
  conversationYawBiasDeg: -7, // State 2: leans toward the left column
  nodPitchDeg: 8,
  breathePx: 1.5,
} as const;

/** How the body follows the head. */
export const TORSO = {
  follow: 0.5, // share of the head's turn the shoulders take
  damping: 1.7, // a little slower than the head, so the body trails it
  roll: 0.28, // shoulders dip into the turn
  shift: 0.028, // and slide sideways (world units per degree)
  pitchFollow: 0.32, // and lean in when he looks down
  breathe: 0.035, // ~3.5px
  sway: 0.9, // idle sway of the shoulders, degrees
  swayPeriod: 7400, // ms
};

/** Motion curves (cubic-bezier control points). */
export const EASE = {
  settle: [0.76, 0, 0.24, 1] as [number, number, number, number],
  arrive: [0.22, 1, 0.36, 1] as [number, number, number, number],
};

/** Touch: movement below this (px) counts as a tap, not a drag. */
export const TAP_SLOP = 10;
