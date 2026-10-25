/**
 * Leaving the hero for another page marks this tab, so coming back (browser
 * back, or a link home) lands on State 2 already settled: no State 1, no boot,
 * no voice. The mark is used once; a reload after that, or a new visit, starts
 * at State 1. Storage can be missing or throw; then it simply starts at State 1.
 */
const KEY = "shiv-settled";

export function markLeaving() {
  try {
    window.sessionStorage.setItem(KEY, "1");
  } catch {
    /* no storage: State 1 on return */
  }
}

export function takeReturn(): boolean {
  try {
    const v = window.sessionStorage.getItem(KEY) === "1";
    window.sessionStorage.removeItem(KEY);
    return v;
  } catch {
    return false;
  }
}
