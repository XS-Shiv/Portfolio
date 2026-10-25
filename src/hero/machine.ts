import { intro, type Spoken } from "./content";

/** The hero's explicit states. */
export type Phase = "idle" | "booting" | "conversation" | "restarting";

export type Line = Spoken & { id: number };

export type HeroState = {
  phase: Phase;
  /** Every line typed in State 2, in order: title, subtitle, body lines. */
  transcript: Line[];
  /** Index into transcript of the first line not yet fully typed. */
  typedUpTo: number;
};

export type HeroEvent =
  | { type: "START" }
  | { type: "SETTLE" }
  | { type: "BOOT_DONE" }
  | { type: "LINE_TYPED" }
  | { type: "FINISH_ALL" }
  | { type: "RESTART" }
  | { type: "RESTART_DONE" };

let lineId = 0;

export const initialState: HeroState = { phase: "idle", transcript: [], typedUpTo: 0 };

export function reducer(state: HeroState, event: HeroEvent): HeroState {
  switch (event.type) {
    case "START":
      if (state.phase !== "idle") return state;
      return {
        phase: "booting",
        transcript: [...intro.lines, ...intro.body].map((l) => ({ ...l, id: ++lineId })),
        typedUpTo: 0,
      };
    case "SETTLE":
      // back from /work: State 2 as it was left, already said, no boot
      if (state.phase !== "idle") return state;
      return {
        phase: "conversation",
        transcript: [...intro.lines, ...intro.body].map((l) => ({ ...l, id: ++lineId })),
        typedUpTo: intro.lines.length + intro.body.length,
      };
    case "BOOT_DONE":
      return state.phase === "booting" ? { ...state, phase: "conversation" } : state;
    case "LINE_TYPED":
      return { ...state, typedUpTo: Math.min(state.typedUpTo + 1, state.transcript.length) };
    case "FINISH_ALL":
      return { ...state, typedUpTo: state.transcript.length };
    case "RESTART":
      return state.phase === "conversation" || state.phase === "booting"
        ? { ...state, phase: "restarting" }
        : state;
    case "RESTART_DONE":
      return state.phase === "restarting" ? { ...initialState } : state;
  }
}

/** The LED lit under the screen: the first in idle, the second once talking. */
export const ledOf = (s: HeroState) => (s.phase === "idle" || s.phase === "restarting" ? 0 : 1);
