/**
 * The visitor's sound choice, shared by every page (on by default). Storage can
 * be missing or throw (private mode, blocked site data); the choice then lasts
 * for this visit only.
 */
const KEY = "shiv-sound";

export function savedSoundPref(): boolean {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === null ? true : v === "on";
  } catch {
    return true;
  }
}

export function saveSoundPref(on: boolean) {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* the choice lasts for this visit */
  }
}
