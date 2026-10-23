/**
 * All words on the site live here. Edit freely; no component needs to change.
 *
 * State 2 is one screen that never scrolls: a status line, the title, subtitle
 * and two asides (spoken aloud and revealed word by word, one after another),
 * the main button with restart beside it, and three glass cards. The button and
 * the cards open their section in place of the introduction.
 *
 * Every line in intro.lines and intro.body is spoken. After editing one, run
 * scripts/make_voice.py to regenerate the clips; until then that line is read
 * by the browser's own voice.
 *
 * No full stops anywhere: where a line has two sentences, "\n" breaks it into
 * two lines instead.
 *
 * Every few seconds one pronoun in the visible text flips I -> we (or my -> our)
 * with a glitch and flips back; see pronouns.ts.
 */

export type Link = { label: string; href: string };

export type Card = {
  /** Also the id of the section it scrolls to. */
  id: string;
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
  /** Top-left signature, every state. */
  signature: "Shiv.",
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
  lines: ["Hey, I'm Shiv", "I make decisions for a living"],
  /** The two serif lines, equal weight, typed after the subtitle. */
  body: [
    "At least, I used to make all of them myself\nThe machine has started developing opinions",
    "I let it handle the introduction\nIn hindsight, that was generous",
  ],
  primary: "View my work",
  cards: [
    {
      id: "situation",
      label: "The human–machine situation",
      sub: "I build with AI\nIt has started building a case for itself",
      image: "/screen/three-quarter.webp",
    },
    {
      id: "behind",
      label: "The human behind the screen",
      sub: "Before the machine takes full credit, there's a human story worth knowing",
      image: "/screen/side.webp",
    },
    {
      id: "notes",
      label: "Notes from the machine",
      sub: "Thoughts on products, technology, and the occasional disagreement between human and machine",
      image: "/screen/back.webp",
    },
  ] as Card[],
};

/** One section per card, in the same order; opens in place of the introduction. */
export const sections: Section[] = [
  {
    id: "situation",
    number: "01",
    status: "ACCESSING BUILD LOGS_",
    title: "The human–machine situation",
    line: "I build with AI\nIt has started building a case for itself",
    note: "The build logs are being written up, the machine insists on one more polish",
    links: [
      { label: "See the code on GitHub", href: "https://github.com/XS-Shiv" },
      { label: "Design case studies", href: "https://shivanand.framer.website" },
    ],
  },
  {
    id: "behind",
    number: "02",
    status: "SCANNING FOR HUMAN_",
    title: "The human behind the screen",
    line: "Before the machine takes full credit, there's a human story worth knowing",
    note: "The long version is being written, by the human this time",
    links: [{ label: "Find me on LinkedIn", href: "https://www.linkedin.com/in/shivanand-shukla" }],
  },
  {
    id: "notes",
    number: "03",
    status: "READING THOUGHTS.TXT_",
    title: "Notes from the machine",
    line: "Thoughts on products, technology, and the occasional disagreement between human and machine",
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
