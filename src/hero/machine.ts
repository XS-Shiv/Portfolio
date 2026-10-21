import { dialogue, options, START_NODE, TOPICS, type NodeId, type OptionId, type ScriptLine } from "./content";

/** The hero's explicit states. */
export type Phase = "idle" | "booting" | "conversation" | "restarting";

/** A line as typed: `text` first, then (optionally) a glitch to `slip` and a switch to `recovery`. */
export type Line = { id: number; text: string; slip?: string; recovery?: string };

export type HeroState = {
  phase: Phase;
  node: NodeId;
  /** Every line the character has said this visit, oldest first. */
  transcript: Line[];
  /** Index into transcript of the first line not yet fully typed. */
  typedUpTo: number;
  explored: string[];
  /** Nodes already visited, so `once` lines (the glitches) play only the first time. */
  visited: NodeId[];
  nods: number;
};

export type HeroEvent =
  | { type: "START" }
  | { type: "BOOT_DONE" }
  | { type: "LINE_TYPED" }
  | { type: "CHOOSE"; option: OptionId }
  | { type: "RESTART" }
  | { type: "RESTART_DONE" };

let lineId = 0;
const toLines = (script: ScriptLine[], seen: boolean): Line[] =>
  script.flatMap((l) => {
    if (typeof l === "string") return [{ id: ++lineId, text: l }];
    if (l.once && seen) return [];
    return [{ id: ++lineId, text: l.text, slip: l.slip, recovery: l.recovery }];
  });

/** What a finished line reads as. */
export const finalText = (l: Line) => l.recovery ?? l.text;

export const initialState: HeroState = {
  phase: "idle",
  node: START_NODE,
  transcript: [],
  typedUpTo: 0,
  explored: [],
  visited: [],
  nods: 0,
};

export function reducer(state: HeroState, event: HeroEvent): HeroState {
  switch (event.type) {
    case "START":
      if (state.phase !== "idle") return state;
      return {
        ...initialState,
        phase: "booting",
        transcript: toLines(dialogue[START_NODE].lines, false),
        visited: [START_NODE],
      };
    case "BOOT_DONE":
      return state.phase === "booting" ? { ...state, phase: "conversation" } : state;
    case "LINE_TYPED":
      return { ...state, typedUpTo: Math.min(state.typedUpTo + 1, state.transcript.length) };
    case "CHOOSE": {
      if (state.phase !== "conversation" && state.phase !== "booting") return state;
      const opt = options[event.option];
      if (!opt?.next || !dialogue[opt.next]) return state;
      const next = dialogue[opt.next];
      const seen = state.visited.includes(opt.next);
      const explored =
        opt.topic && !state.explored.includes(opt.topic) ? [...state.explored, opt.topic] : state.explored;
      return {
        ...state,
        phase: "conversation",
        node: opt.next,
        transcript: [...state.transcript, ...toLines(next.lines, seen)],
        // anything still typing is finished instantly so the reply starts now
        typedUpTo: state.transcript.length,
        explored,
        visited: seen ? state.visited : [...state.visited, opt.next],
        nods: state.nods + 1,
      };
    }
    case "RESTART":
      return state.phase === "conversation" || state.phase === "booting"
        ? { ...state, phase: "restarting" }
        : state;
    case "RESTART_DONE":
      return state.phase === "restarting" ? { ...initialState } : state;
  }
}

export const progressOf = (s: HeroState) => (TOPICS.length ? s.explored.length / TOPICS.length : 0);

/**
 * The LED lit under the screen (0-4). Off in idle; once talking, one more lights
 * for every topic explored, so the monitor keeps score.
 */
export const ledOf = (s: HeroState) =>
  s.phase === "idle" || s.phase === "restarting" ? 0 : Math.min(4, 1 + s.explored.length);
