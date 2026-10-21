/**
 * All words on the hero live here. Edit freely; no component needs to change.
 *
 * The conversation is a small graph. Each node has:
 * - `system`: a short terminal line above the conversation (the machine's voice)
 * - `lines`: what the character says, typed in order. The newest line is large,
 *   the one before it small and faded.
 * - `sub`: a short subtext under the large line
 * - `screen`: the caption on the monitor under the eyes
 * - `options`: the replies. The first is the main call to action, the rest are minor.
 *
 * The "I → we" glitch: a line can carry a `slip` (the same sentence with "we")
 * and a `recovery`. It types normally, flashes the slip for a moment, then is
 * replaced by the recovery, as if nothing happened. Mark it `once` so it only
 * plays the first time a node is visited. Keep these rare.
 */

export type Link = { label: string; href: string };

export type OptionId = string;
export type NodeId = string;

export type DialogueOption = {
  id: OptionId;
  label: string;
  /** Small line under the label. */
  sub?: string;
  /** Go to this node. */
  next?: NodeId;
  /** Or open this link. */
  href?: string;
  /** Or open the contact panel. */
  action?: "connect";
  /** Counts toward the progress bar and the LEDs once per visit. */
  topic?: string;
};

export type ScriptLine =
  | string
  | {
      text: string;
      /** The glitch frame: the same line, slipping into "we". */
      slip?: string;
      /** What it says after catching itself. Stays on screen. */
      recovery?: string;
      /** Skip this line when the node is visited again. */
      once?: boolean;
    };

export type DialogueNode = {
  system: string;
  lines: ScriptLine[];
  sub: string;
  screen: string;
  options: OptionId[];
};

export const site = {
  name: "Shivanand Shukla",
  /** Top-left signature. */
  signature: "Shiv.",
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

export const hints = {
  restart: "Start over",
  soundOn: "Turn sound off",
  soundOff: "Turn sound on",
  progress: "Topics explored",
};

export const options: Record<OptionId, DialogueOption> = {
  situation: {
    id: "situation",
    label: "The human-machine situation",
    sub: "Things I built with AI. Or things we built. Apparently, there's a difference.",
    next: "situation",
    topic: "situation",
  },
  behind: {
    id: "behind",
    label: "Who's behind the screen?",
    sub: "The original human. Last time I checked.",
    next: "behind",
    topic: "behind",
  },
  thoughts: {
    id: "thoughts",
    label: "Thoughts from the machine",
    sub: "My thoughts, mostly. We think.",
    next: "thoughts",
    topic: "thoughts",
  },
  process: {
    id: "process",
    label: "How do you actually build?",
    sub: "The process, minus the mystery.",
    next: "process",
  },
  code: {
    id: "code",
    label: "See the code on GitHub",
    sub: "Where the experiments live.",
    href: "https://github.com/XS-Shiv",
  },
  hello: {
    id: "hello",
    label: "Say hello",
    sub: "Email, LinkedIn or GitHub. The human answers.",
    action: "connect",
  },
  medium: {
    id: "medium",
    label: "Read them on Medium",
    sub: "Essays on AI, design and attention.",
    href: "https://medium.com/@shivanandisshukla",
  },
};

export const dialogue: Record<NodeId, DialogueNode> = {
  intro: {
    system: "CONNECTION ESTABLISHED_",
    lines: [
      "Well, this is slightly concerning.",
      "I'm Shiv. This is my portfolio. The machine would like you to believe it had more input.",
    ],
    sub: "I let it handle the introduction. In hindsight, that was generous.",
    screen: "HELLO, HUMAN_",
    options: ["situation", "behind", "thoughts"],
  },
  situation: {
    system: "ACCESSING BUILD LOGS_",
    lines: [
      {
        text: "Here's what I've been building.",
        slip: "Here's what we've been building.",
        recovery: "Sorry. I've been building.",
        once: true,
      },
      "I started using AI to build things. Somewhere along the way, it started acting like it worked here.",
    ],
    sub: "Working prototypes, experiments, and a mildly concerning amount of collaboration.",
    screen: "LOADING LOGS_",
    options: ["process", "behind", "thoughts"],
  },
  process: {
    system: "OPENING PROCESS.LOG_",
    lines: [
      {
        text: "I use AI to turn ideas into working products.",
        slip: "We use AI to turn ideas into working products.",
        recovery: "That sounded less strange in my head.",
        once: true,
      },
      "I plan the product, then build the first version myself. The machine types fast. I decide what's worth typing.",
    ],
    sub: "The full build log is on its way. The machine insists on more polish.",
    screen: "PROCESSING_",
    options: ["code", "behind", "thoughts"],
  },
  behind: {
    system: "SCANNING FOR HUMAN_",
    lines: [
      {
        text: "I'm the person behind all this.",
        slip: "We're the person behind all this.",
        recovery: "Okay. We need to work on that sentence.",
        once: true,
      },
      "Before you ask, yes, there is an actual person under all this hardware.",
    ],
    sub: "My background, what I do, and the parts of me that aren't terminal output.",
    screen: "HUMAN DETECTED_",
    options: ["hello", "situation", "thoughts"],
  },
  thoughts: {
    system: "READING THOUGHTS.TXT_",
    lines: ["Occasionally, I have thoughts. Occasionally, the machine agrees with them."],
    sub: "Notes on products, AI, ideas, and things I've probably overthought.",
    screen: "THINKING..._",
    options: ["medium", "situation", "behind"],
  },
};

export const START_NODE: NodeId = "intro";

/** Topics that fill the progress bar and light the LEDs. */
export const TOPICS = Array.from(new Set(Object.values(options).flatMap((o) => (o.topic ? [o.topic] : []))));
