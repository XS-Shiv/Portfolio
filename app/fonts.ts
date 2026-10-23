import localFont from "next/font/local";

/**
 * State 2 type: one main face for Shiv's lines, one mono face for system lines
 * (the monitor screen keeps VT323). Three candidate pairings, all OFL-licensed
 * and self-hosted through next/font, which adds a size-adjusted fallback so
 * nothing shifts when the font arrives.
 *
 * PAIRING picks the one the site uses; when you change it, also move
 * `preload: true` to that pairing's two fonts (next/font needs literal options).
 * The others are never downloaded unless previewed with ?font=plex | geist |
 * inter on the URL.
 */
export const PAIRINGS = ["plex", "geist", "inter"] as const;
export type Pairing = (typeof PAIRINGS)[number];
export const PAIRING: Pairing = "plex";

const plexSans = localFont({
  src: "./fonts/plex-sans.woff2",
  weight: "100 700",
  variable: "--f-plex-sans",
  preload: true,
  adjustFontFallback: "Arial",
});
const plexMono = localFont({
  src: "./fonts/plex-mono.woff2",
  weight: "400",
  variable: "--f-plex-mono",
  preload: true,
  adjustFontFallback: false,
});
const geist = localFont({
  src: "./fonts/geist.woff2",
  weight: "100 900",
  variable: "--f-geist",
  preload: false,
  adjustFontFallback: "Arial",
});
const geistMono = localFont({
  src: "./fonts/geist-mono.woff2",
  weight: "100 900",
  variable: "--f-geist-mono",
  preload: false,
  adjustFontFallback: false,
});
const interTight = localFont({
  src: "./fonts/inter-tight.woff2",
  weight: "100 900",
  variable: "--f-inter-tight",
  preload: false,
  adjustFontFallback: "Arial",
});
const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono.woff2",
  weight: "100 800",
  variable: "--f-jetbrains",
  preload: false,
  adjustFontFallback: false,
});

export const fontVariables = [plexSans, plexMono, geist, geistMono, interTight, jetbrainsMono]
  .map((f) => f.variable)
  .join(" ");
