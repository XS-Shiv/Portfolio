/**
 * Every timing and motion value in the hero, in milliseconds unless noted.
 * Tweak here, nowhere else. In development, add ?tune to the URL for a live
 * panel over MOTION and CABLE; copy the values it prints back into this file.
 */
export const T = {
  // State 1: idle
  nudgeMin: 6000, // something new on the screen every 6–8s without a start
  nudgeMax: 8000,
  nudgeFlicker: 160, // CRT flicker before each nudge
  imagePop: 2600, // how long a picture stays on the screen
  firstPop: 2200, // the first picture comes early, so a quick visitor still sees one

  // Transition: booting
  powerOn: 280, // scan-line flash
  bootLineUntil: 480, // boot line visible from powerOn to here
  slideDelay: 0, // character starts sliding
  slide: 700, // character slide / scale / turn
  restartSlide: 700,
  firstLineAt: 260, // left column starts typing

  // Typing, when there is no voice timing to follow (muted text-only fallback)
  perChar: 16,
  punctuationPause: 60, // extra after . , ? !
  betweenLines: 60,
  cardPerChar: 6, // the three cards type together, this fast
  ctaAfterLine: 1, // the main button, restart and cards land once this line (0-based) is done, so they can pulse with the voice

  // The "I -> we" glitch: an occasional beat once everything has appeared
  flipFirst: 2600, // the first one comes a little sooner
  flipEveryMin: 9000,
  flipEveryMax: 14000,
  flipIn: 150, // glitch into "we"
  flipHold: 1800, // "we" stays on screen long enough to be noticed
  flipNotice: 140, // a second small flicker as he notices
  flipOut: 150, // glitch back to "I"

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
  breathePeriod: 4600,
} as const;

/**
 * How the character looks at the cursor. Springs are integrated with the real
 * frame time, so the feel is the same at 30, 60 or 144fps.
 */
export const MOTION = {
  // ---- mapping: the cursor is projected onto a plane in front of the head
  planeDist: 0.55, // how far that plane is, as a share of the viewport height (smaller = more eager)
  gain: 1.25, // >1 so small moves near the head still give a visible turn
  maxYaw: 40, // soft limits (degrees); the response eases into them, never a hard stop
  maxPitchDown: 18,
  maxPitchUp: 14,
  rollPerYaw: 0.1, // the head tilts into the turn: degrees of roll per degree of yaw (4° at full turn)

  // ---- head: slightly underdamped, ~155ms to 90% of a step, ~3% overshoot
  headOmega: 18, // rad/s
  headZeta: 0.75,
  // ---- neck: trails the head by ~40ms and takes part of the bend
  neckOmega: 50,
  neckShare: 0.35, // share of the head's angle the neck's bend carries
  // ---- torso: trails by ~150ms, critically damped
  torsoOmega: 13,
  torsoYaw: 0.25, // ±10° at a full head turn
  torsoPitch: 0.17, // ±3°
  torsoRoll: 0.18, // shoulders dip into the turn
  lean: 0.02, // the whole figure shifts this share of its width toward the cursor at a full turn
  breathe: 0.016, // chest rise, world units (~1.6px of the photo)
  breatheTilt: 0.35, // degrees of chest pitch per breath

  // ---- idle life, once the cursor has been still this long (or has left)
  idleAfter: 1500,
  saccadeMin: 2000, // tiny head darts every 2–5s
  saccadeMax: 5000,
  saccadeDeg: 1.6,
  tiltMin: 7000, // an occasional curious tilt
  tiltMax: 13000,
  tiltDeg: 6,
  tiltFor: 1500,
  leaveEase: 3.2, // λ (1/s) for easing to the neutral pose once the cursor leaves (~1s)
  neutralYaw: 9, // neutral pose: slightly off-centre, never dead centre
  neutralPitch: 2,

  // ---- velocity: a fast flick lags, snaps and overshoots on its own; above this the screen flickers once
  flickDegPerSec: 320,

  // ---- the glass has depth: screen content shifts against the turn (screen pixels at a full turn)
  parallaxPx: 16,

  // ---- State 2: an imposing three-quarter pose toward the text; the follow is smaller around it
  talkYaw: -22,
  talkPitch: 5,
  talkRoll: 4,
  talkFollow: 0.45,
  glanceHold: 1200, // a hovered or focused button keeps the head's attention this long
  // phone layout
  talkYawCompact: -8,
  talkPitchCompact: 3,
  talkFollowCompact: 0.6,
  nodDeg: 8,
};

/** The audio cables: old black rubber cords with jack plugs, simulated as ropes. */
export const CABLE = {
  radius: 0.05, // world units (1 = 100 photo pixels); every cord is the same thickness
  points: 22, // rope points per cable
  slack: 1.45, // cord length / straight distance at rest
  gravity: 140, // units/s²
  damping: 0.982, // velocity kept per 1/120s step
  iterations: 20, // length constraint passes per step (no stretching)
  step: 1 / 120, // fixed simulation step (s)
  tubeSegments: 56, // smoothness along the cord
  tubeRadial: 8,
};

/** Motion curves (cubic-bezier control points). */
export const EASE = {
  settle: [0.76, 0, 0.24, 1] as [number, number, number, number],
  arrive: [0.22, 1, 0.36, 1] as [number, number, number, number],
};

/** Touch: movement below this (px) counts as a tap, not a drag. */
export const TAP_SLOP = 10;
