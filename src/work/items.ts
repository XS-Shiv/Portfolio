import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import { type DesignType, type Kind, TABS, type TabId } from "./config";
import { type AboutHook, sortItems, type WorkItem } from "./model";

export type { WorkItem } from "./model";

/**
 * Work items: one Markdown file per item in content/work/<slug>.md, with typed
 * frontmatter checked at build time (a bad field fails the build and names the
 * file). The body is ordinary Markdown; each "## Heading" becomes a section of
 * the project page, in the order written. Sections left empty or "TODO" are skipped.
 *
 * Drafts are only ever read in development. A published item that still
 * contains "TODO" fails the production build, so placeholders never ship.
 */

export type Section = { heading: string; html: string };
export type WorkPage = WorkItem & { sections: Section[] };

const DIR = join(process.cwd(), "content/work");
const DEV = process.env.NODE_ENV === "development";

const TAB_IDS = TABS.map((t) => t.id);
const ONE_OF = {
  kind: ["live", "case-study", "concept"],
  status: ["published", "draft"],
  designType: ["ux", "product", "merch", "game"],
  aboutHook: ["defence", "maker", "play", "craft"],
};

function check(file: string, d: Record<string, unknown>): WorkItem {
  const fail = (msg: string) => {
    throw new Error(`content/work/${file}: ${msg}`);
  };
  const str = (k: string, required = false) => {
    const v = d[k];
    if (v === undefined || v === null) return required ? fail(`"${k}" is required`) : undefined;
    if (typeof v !== "string" || !v.trim()) return fail(`"${k}" must be a non-empty string`);
    return v;
  };
  const oneOf = (k: keyof typeof ONE_OF, required = false) => {
    const v = str(k, required);
    if (v !== undefined && !ONE_OF[k].includes(v)) fail(`"${k}" must be one of ${ONE_OF[k].join(", ")}`);
    return v;
  };
  const slug = str("slug", true)!;
  if (`${slug}.md` !== file) fail(`slug "${slug}" must match the file name`);
  if (!Array.isArray(d.tabs) || !d.tabs.length) fail(`"tabs" must be a non-empty list`);
  for (const t of d.tabs as unknown[]) if (!TAB_IDS.includes(t as TabId)) fail(`unknown tab "${t}"`);
  if (typeof d.priority !== "number") fail(`"priority" must be a number (1 = most relevant)`);
  if (d.tools !== undefined && (!Array.isArray(d.tools) || d.tools.some((t) => typeof t !== "string")))
    fail(`"tools" must be a list of strings`);
  if (d.metrics !== undefined) {
    const m = d.metrics as unknown[];
    if (!Array.isArray(m) || m.length > 3 || m.some((x) => !x || typeof x !== "object" || !("value" in x) || !("label" in x)))
      fail(`"metrics" must be a list of up to 3 { value, label }`);
  }
  if (d.links !== undefined) {
    if (typeof d.links !== "object" || d.links === null) fail(`"links" must be { live, github, deck }`);
    for (const [k, v] of Object.entries(d.links as object)) {
      if (!["live", "github", "deck"].includes(k)) fail(`unknown link "${k}"`);
      if (typeof v !== "string" || !/^(https?:\/\/|\/)/.test(v)) fail(`link "${k}" must be a URL or a /path`);
    }
  }
  return {
    slug,
    title: str("title", true)!,
    oneLiner: str("oneLiner", true)!,
    tabs: d.tabs as TabId[],
    designType: oneOf("designType") as DesignType | undefined,
    kind: oneOf("kind", true) as Kind,
    status: oneOf("status", true) as WorkItem["status"],
    priority: d.priority as number,
    metric: str("metric"),
    metrics: d.metrics as WorkItem["metrics"],
    role: str("role"),
    timeline: str("timeline"),
    team: str("team"),
    tools: d.tools as string[] | undefined,
    links: d.links as WorkItem["links"],
    cover: str("cover"),
    aboutHook: oneOf("aboutHook") as AboutHook | undefined,
  };
}

/** Markdown body -> sections, one per "## Heading"; empty and TODO-only sections are dropped. */
function sectionsOf(body: string): Section[] {
  const parts = body.split(/^##\s+(.+)$/m);
  const out: Section[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const md = parts[i + 1].trim();
    if (!md || /^TODO\b/i.test(md)) continue;
    const html = (marked.parse(md, { async: false }) as string).replace(
      /<img /g,
      '<img loading="lazy" decoding="async" ',
    );
    out.push({ heading: parts[i].trim(), html });
  }
  return out;
}

let cache: WorkPage[] | null = null;

/** Every item this build may show: published ones, plus drafts in development. */
function load(): WorkPage[] {
  if (cache && !DEV) return cache;
  const pages = readdirSync(DIR)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .map((file) => {
      const { data, content } = matter(readFileSync(join(DIR, file), "utf8"));
      const item = check(file, data);
      if (item.status === "published" && /\bTODO\b/.test(JSON.stringify(data) + content))
        throw new Error(`content/work/${file}: published but still contains TODO`);
      return { ...item, sections: sectionsOf(content) };
    })
    .filter((p) => DEV || p.status === "published");
  cache = pages;
  return pages;
}

/** Card data only (no bodies), for the /work listing. */
export function getItems(): WorkItem[] {
  return sortItems(load()).map(({ sections, ...item }) => {
    void sections;
    return item;
  });
}

export function getPage(slug: string): WorkPage | undefined {
  return load().find((p) => p.slug === slug);
}

/** Items with an About hook, most relevant first. The About page will use this. */
export function getAboutHighlights(): WorkItem[] {
  return getItems().filter((i) => i.aboutHook);
}
