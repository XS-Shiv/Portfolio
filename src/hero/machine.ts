import { dialogue, options, START_NODE, TOPICS, type NodeId, type OptionId } from "./content";

/** The hero's explicit states. */
export type Phase = "idle" | "booting" | "conversation" | "restarting";

export type Line = { id: number; text: string };

export type HeroState = {
  phase: Phase;
  node: NodeId;
  /** Every line the character has said this visit, oldest first. */
  transcript: Line[];
  /** Index into transcript of the first line not yet fully typed. */
  typedUpTo: number;
  explored: string[];
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
const toLines = (texts: string[]): Line[] => texts.map((text) => ({ id: ++lineId, text }));

export const initialState: HeroState = {
  phase: "idle",
  node: START_NODE,
  transcript: [],
  typedUpTo: 0,
  explored: [],
  nods: 0,
};

export function reducer(state: HeroState, event: HeroEvent): HeroState {
  switch (event.type) {
    case "START":
      if (state.phase !== "idle") return state;
      return {
        ...initialState,
        phase: "booting",
        transcript: toLines(dialogue[START_NODE].lines),
      };
    case "BOOT_DONE":
      return state.phase === "booting" ? { ...state, phase: "conversation" } : state;
    case "LINE_TYPED":
      return { ...state, typedUpTo: Math.min(state.typedUpTo + 1, state.transcript.length) };
    case "CHOOSE": {
      if (state.phase !== "conversation" && state.phase !== "booting") return state;
      const opt = options[event.option];
      if (!opt) return state;
      const next = dialogue[opt.next];
      const explored =
        opt.topic && !state.explored.includes(opt.topic) ? [...state.explored, opt.topic] : state.explored;
      const transcript = [...state.transcript, ...toLines(next.lines)];
      return {
        ...state,
        phase: "conversation",
        node: opt.next,
        transcript,
        // anything still typing is finished instantly so the reply starts now
        typedUpTo: state.transcript.length,
        explored,
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

/** The LED lit under the screen: 1 in idle, 2 once talking. */
export const ledOf = (phase: Phase) => (phase === "idle" || phase === "restarting" ? 0 : 1);
