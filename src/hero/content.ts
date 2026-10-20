/**
 * All words on the hero live here. Edit freely; no component needs to change.
 *
 * The conversation is a small graph. Each node has the lines the character types
 * and the reply options the visitor can pick. An option points at the next node.
 * To add a real "work" state later, give the `work` node new lines and options.
 */

export type Link = { label: string; href: string };

export type OptionId = string;
export type NodeId = string;

export type DialogueOption = {
  id: OptionId;
  label: string;
  next: NodeId;
  /** Counts toward the progress bar once per visit. */
  topic?: string;
};

export type DialogueNode = {
  /** Typed in order. In State 2 the newest line is large, the one before it faded. */
  lines: string[];
  options: OptionId[];
  /** Optional link shown under the newest line once it has finished typing. */
  link?: Link;
};

export const site = {
  name: "Shivanand Shukla",
  title: "Shivanand Shukla — AI-first product manager",
  description: "Shiv is an AI-first product manager who builds what he plans. Say hi to the CRT.",
  connectLabel: "Let's connect",
};

export const contact: Link[] = [
  { label: "Email", href: "mailto:shivanand.shukla2027@mastersunion.org" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/shivanand-shukla" },
  { label: "GitHub", href: "https://github.com/XS-Shiv" },
];

/** Top-centre nav in State 2. `topic` picks that reply; `href` opens a page. */
export const nav: { label: string; topic?: OptionId; href?: string }[] = [
  { label: "Work", topic: "work" },
  { label: "Builds", topic: "builds" },
  { label: "About", topic: "about" },
  { label: "Writing", href: "https://medium.com/@shivanandisshukla" },
];

export const screen = {
  idle: "[CLICK] TO START_",
  nudges: ["psst… click me", "I don't bite", "[CLICK] TO START_"],
  boot: "SHIV.OS  READY",
};

export const hints = {
  side: "psst… click the screen",
  pointer: "move your cursor · click anywhere to start",
  touch: "drag to look around · tap anywhere to start",
  restart: "Start over",
  sound: "Sound",
  soundOn: "Sound on",
  soundOff: "Muted",
  menu: "Menu",
  progress: "Topics explored",
};

export const options: Record<OptionId, DialogueOption> = {
  work: { id: "work", label: "Show me your work →", next: "work", topic: "work" },
  builds: { id: "builds", label: "What have you built with AI?", next: "builds", topic: "builds" },
  about: { id: "about", label: "Who are you, really?", next: "about", topic: "about" },
  resume: { id: "resume", label: "Grab the resume ↓", next: "resume", topic: "resume" },
};

const replies: OptionId[] = ["work", "builds", "about", "resume"];

export const dialogue: Record<NodeId, DialogueNode> = {
  intro: {
    lines: [
      "Oh, hey. You found me.",
      "I'm Shiv. A product manager who builds what he plans, with AI. What do you want to see first?",
    ],
    options: replies,
  },
  work: {
    lines: ["Case studies are getting a final polish. Until then, my design work lives here."],
    options: replies,
    link: { label: "shivanand.framer.website ↗", href: "https://shivanand.framer.website" },
  },
  builds: {
    lines: ["A proper tour of my AI builds is coming soon. The code is already on GitHub."],
    options: replies,
    link: { label: "github.com/XS-Shiv ↗", href: "https://github.com/XS-Shiv" },
  },
  about: {
    lines: ["The long version is coming soon. Short version: engineer turned PM, five cities, one sweater."],
    options: replies,
  },
  resume: {
    lines: ["A fresh copy is on its way. Say hi via Let's connect and I'll send it over."],
    options: replies,
  },
};

export const START_NODE: NodeId = "intro";

/** Topics that fill the progress bar. */
export const TOPICS = Array.from(new Set(Object.values(options).flatMap((o) => (o.topic ? [o.topic] : []))));
