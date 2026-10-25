/**
 * The Work section's words, tabs and rules. Edit freely; no component needs to change.
 */

export type TabId = "featured" | "built-with-ai" | "product-strategy" | "design" | "playground";
export type DesignType = "ux" | "product" | "merch" | "game";
export type Kind = "live" | "case-study" | "concept";

/** Tabs in display order. */
export const TABS: { id: TabId; label: string }[] = [
  { id: "featured", label: "Featured" },
  { id: "built-with-ai", label: "Built with AI" },
  { id: "product-strategy", label: "Product & Strategy" },
  { id: "design", label: "Design" },
  { id: "playground", label: "Playground" },
];

/** Playground (craft and fun) is meant for the About page; switch on to show it on /work. */
export const SHOW_PLAYGROUND = false;
/** A tab appears only with at least this many published items (Featured needs just one). */
export const MIN_ITEMS_PER_TAB = 2;

/** Filter chips inside the Design tab, in order. */
export const DESIGN_TYPES: { id: DesignType; label: string }[] = [
  { id: "ux", label: "UX" },
  { id: "product", label: "Product" },
  { id: "merch", label: "Merch" },
  { id: "game", label: "Game" },
];

export const KIND_LABEL: Record<Kind, string> = {
  live: "Live",
  "case-study": "Case study",
  concept: "Concept",
};

/** A short tag for each tab, shown on cards. */
export const TAB_TAG: Record<TabId, string> = {
  featured: "Featured",
  "built-with-ai": "AI build",
  "product-strategy": "Strategy",
  design: "Design",
  playground: "Play",
};

export const workCopy = {
  title: "Things I've built, broken and designed.",
  subline: "> sorted by how much they prove_",
  back: "← back to the machine",
  empty: {
    title: "Nothing to show yet.",
    line: "The machine is still compiling the evidence. The human promises it's worth the wait.",
    status: "> 0 items published_",
  },
  backToWork: "← back to work",
  previous: "Previous",
  next: "Next",
  facts: { role: "Role", timeline: "Timeline", team: "Team", tools: "Tools" },
  links: { live: "Visit live site", github: "See the code", deck: "Open the deck" },
};

/** Motion on the Work pages (ms unless noted). */
export const WORK_MOTION = {
  tabSwitch: 220, // the grid fades and slides in when the tab changes
  tabSlide: 8, // px
  cardLift: 4, // px on hover/focus
};
