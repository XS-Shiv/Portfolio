/**
 * All words on the site live here. Edit freely; no component needs to change.
 *
 * State 2 is one screen that never scrolls: the status line top-left, the
 * headline and subhead, two short paragraphs (spoken aloud and revealed in
 * step with the voice), the main button, and three glass cards. The button and
 * the cards open their section in place of the introduction.
 *
 * Every Spoken line is read aloud. `text` is what shows on screen; `spoken`
 * (optional) is what the voice reads, so you can shape delivery without
 * changing the screen. In `spoken`:
 *   " / "   a short beat (VOICE.beat in timings.ts)
 *   " // "  a long pause before a punchline (VOICE.punchline)
 *   a sentence end (". ") is a sentence pause (VOICE.sentence)
 * Commas and ellipses are read by the voice itself.
 * After editing a spoken line, run scripts/generate-voice.ts; only changed
 * lines regenerate. Until then the browser's own voice reads it.
 *
 * Now and then "I'm" in the headline glitches to "we're" and back; see
 * pronouns.ts and T.flip* in timings.ts.
 */

export type Link = { label: string; href: string };

/** A line Shiv says: what shows on screen, and (optionally) what the voice reads. */
export type Spoken = { text: string; spoken?: string };

export type Card = {
  /** The id of the section it opens in place of the introduction, unless it has an href. */
  id: string;
  /** A page to go to instead (with the CRT exit). */
  href?: string;
  number: string;
  label: string;
  sub: string;
  /** Photo behind the card text, shown dark and grey. */
  image: string;
};

export type Section = {
  id: string;
  number: string;
  /** The machine's terminal line above the section. */
  status: string;
  title: string;
  line: string;
  /** A short note while the full section is being written. */
  note: string;
  links: Link[];
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
  /** Revealed in order: the headline, then the subhead. */
  lines: [
    { text: "Hey, I'm Shiv.", spoken: "Hey, / I'm Shiv." },
    { text: "I make decisions for a living." },
  ] as Spoken[],
  /** Two short paragraphs, revealed after the subhead. */
  body: [
    { text: "Lately, the machine has started having its opinions about them." },
    {
      text: "And, occasionally, I let it handle some. In hindsight, I think it's generous.",
      spoken: "And, occasionally, / I let it handle some. // In hindsight, I think it's generous.",
    },
  ] as Spoken[],
  primary: "View my work",
  /** Where the main button goes (with the CRT exit). */
  primaryHref: "/work",
  cards: [
    {
      id: "situation",
      href: "/work?tab=built-with-ai",
      number: "01",
      label: "The human–machine situation",
      sub: "I build with AI. Now it has started building a case for itself.",
      image: "/screen/three-quarter.webp",
    },
    {
      id: "behind",
      number: "02",
      label: "The human behind the screen",
      sub: "Before the machine takes full credit, there's a human story worth knowing.",
      image: "/screen/side.webp",
    },
    {
      id: "notes",
      number: "03",
      label: "Notes from the human machine",
      sub: "Thoughts on products, technology, and the occasional disagreement between human and machine.",
      image: "/screen/back.webp",
    },
  ] as Card[],
};

/** Cards without an href open their section in place of the introduction. */
export const sections: Section[] = [
  {
    id: "behind",
    number: "02",
    status: "SCANNING FOR HUMAN_",
    title: "The human behind the screen",
    line: "Before the machine takes full credit, there's a human story worth knowing.",
    note: "The long version is being written, by the human this time",
    links: [{ label: "Find me on LinkedIn", href: "https://www.linkedin.com/in/shivanand-shukla" }],
  },
  {
    id: "notes",
    number: "03",
    status: "READING THOUGHTS.TXT_",
    title: "Notes from the human machine",
    line: "Thoughts on products, technology, and the occasional disagreement between human and machine.",
    note: "Essays on AI, design and attention economics",
    links: [{ label: "Read on Medium", href: "https://medium.com/@shivanandisshukla" }],
  },
];

export const hints = {
  restart: "Start over",
  back: "Back",
  soundOn: "Turn sound off",
  soundOff: "Turn sound on",
};
