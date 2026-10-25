import { MIN_ITEMS_PER_TAB, SHOW_PLAYGROUND, TABS, type DesignType, type Kind, type TabId } from "./config";

/** The shape of a work item, and the pure rules shared by the server and the /work page. */

export type AboutHook = "defence" | "maker" | "play" | "craft";

export type WorkItem = {
  slug: string;
  title: string;
  oneLiner: string;
  tabs: TabId[];
  designType?: DesignType;
  kind: Kind;
  status: "published" | "draft";
  priority: number;
  metric?: string;
  /** Up to three headline numbers for the project page; falls back to `metric`. */
  metrics?: { value: string; label: string }[];
  role?: string;
  timeline?: string;
  team?: string;
  tools?: string[];
  links?: { live?: string; github?: string; deck?: string };
  cover?: string;
  aboutHook?: AboutHook;
};

/** Most relevant first: priority, then live items with a metric, then title. */
export function sortItems<T extends WorkItem>(items: T[]) {
  const score = (i: WorkItem) => (i.kind === "live" && i.metric ? 0 : 1);
  return [...items].sort((a, b) => a.priority - b.priority || score(a) - score(b) || a.title.localeCompare(b.title));
}

/** Which tabs to show for a set of items (computed, never hard-coded). */
export function visibleTabs(items: WorkItem[]): TabId[] {
  return TABS.map((t) => t.id).filter((id) => {
    if (id === "playground" && !SHOW_PLAYGROUND) return false;
    const n = items.filter((i) => i.tabs.includes(id)).length;
    return id === "featured" ? n >= 1 : n >= MIN_ITEMS_PER_TAB;
  });
}

