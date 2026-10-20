/**
 * Every timing in the hero, in milliseconds unless noted. Tweak here, nowhere else.
 * Values come from docs/design/hero-direction.md.
 */
export const T = {
  // State 1: idle
  hintDelay: 4000, // bottom "move your cursor" hint fades in
  nudgeMin: 6000, // a screen nudge every 6–8s without a start
  nudgeMax: 8000,
  nudgeFlicker: 160, // CRT flicker before each nudge
  sideHintEvery: 14000, // "psst… click the screen" beside the monitor
  sideHintFor: 3200,

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

  // Screen face
  blinkMin: 2800,
  blinkMax: 5200,
  blinkFor: 120,
  talkFrame: 90,
  nod: 420,

  // Character
  breathePeriod: 4800,
} as const;

/** Head follow. */
export const HEAD = {
  maxYawDeg: 25,
  maxPitchDeg: 15, // looking down
  maxPitchUpDeg: 10, // looking up shows the neck, so a little less
  damping: 4, // exponential damping λ; ~250ms to 63% of the way
  restYawDeg: 22, // no pointer yet: slightly turned, like the photo
  restPitchDeg: 4,
  conversationYawBiasDeg: -9, // State 2: leans toward the left column
  nodPitchDeg: 8,
  breathePx: 1.5,
} as const;

/** Motion curves (cubic-bezier control points). */
export const EASE = {
  settle: [0.76, 0, 0.24, 1] as [number, number, number, number],
  arrive: [0.22, 1, 0.36, 1] as [number, number, number, number],
};

/** Touch: movement below this (px) counts as a tap, not a drag. */
export const TAP_SLOP = 10;
