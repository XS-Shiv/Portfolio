/**
 * All words on the hero live here. Edit freely; no component needs to change.
 *
 * State 2 reads top to bottom: a status line in the top bar, the title and
 * subtitle (typed), two short body lines, one main button and three cards.
 * The buttons and cards do nothing yet; they will open sections later.
 *
 * Every few seconds, once everything has appeared, one pronoun in the visible
 * text flips I <-> we (or my <-> our) with a glitch and flips back. That is the
 * recurring "human but a machine" device; see pronouns.ts.
 */

export type Link = { label: string; href: string };

export type Card = {
  id: string;
  label: string;
  sub: string;
  /** Photo behind the card text, shown dark and grey. */
  image: string;
};

export const site = {
  name: "Shivanand Shukla",
  title: "Shivanand Shukla · AI product manager who builds",
  description:
    "Shivanand Shukla is an AI-first product manager who builds what he plans. Click the monitor to say hi.",
  connectLabel: "Let's talk",
};

export const contact: Link[] = [
  { label: "Email", href: "mailto:shivanand.shukla2027@mastersunion.org" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/shivanand-shukla" },
  { label: "GitHub", href: "https://github.com/XS-Shiv" },
];

export const screen = {
  idle: "[CLICK] TO START_",
  nudges: ["HELLO? HUMAN?_", "I DON'T BITE_", "YES, I'M A MONITOR_", "HUMAN INSIDE_", "[CLICK] TO START_"],
  boot: "CONNECTING...",
  /**
   * Pictures that flash on the screen between nudges, broadcast in CRT colours.
   * Drop your own photos in public/screen/ and list them here; "pixel:heart",
   * "pixel:bulb", "pixel:spark" and "pixel:hi" are built in.
   */
  images: [
    "/screen/three-quarter.webp",
    "pixel:hi",
    "/screen/side.webp",
    "pixel:bulb",
    "/screen/back.webp",
    "pixel:heart",
  ],
};

/** The status line top-left. Nothing in State 1. */
export const status = {
  booting: "CONNECTING...",
  ready: "CONNECTION ESTABLISHED_",
};

export const intro = {
  /** Typed in order: the title, then the subtitle. */
  lines: ["Hey, I'm Shiv.", "This is my portfolio."],
  body: [
    "The machine would like you to believe it had more input.",
    // "\n" sets where the line breaks on wide screens
    "I let it handle the introduction. In hindsight,\nthat was generous.",
  ],
  primary: "View my work",
  cards: [
    {
      id: "situation",
      label: "The human-machine situation",
      sub: "Things I built with AI. Or things we built.",
      image: "/screen/three-quarter.webp",
    },
    {
      id: "behind",
      label: "Who's behind the screen?",
      sub: "The original human. Last time I checked.",
      image: "/screen/side.webp",
    },
    {
      id: "thoughts",
      label: "Thoughts from the machine",
      sub: "My thoughts, mostly. We think.",
      image: "/screen/back.webp",
    },
  ] as Card[],
};

export const hints = {
  restart: "Start over",
  soundOn: "Turn sound off",
  soundOff: "Turn sound on",
};
