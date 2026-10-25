"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type TabId, TABS, workCopy } from "./config";

type Link_ = { slug: string; title: string } | null;
export type Neighbours = Partial<Record<TabId, { prev: Link_; next: Link_ }>>;
type Props = { home: TabId; neighbours: Neighbours; part: "back" | "nav" };

/** "Back to work" and previous/next, for the tab the visitor came from (?from=). */
export function ProjectFooter(props: Props) {
  const from = useSearchParams().get("from");
  return <Footer {...props} from={from} />;
}

/** The prerendered version, before the URL is read: the item's own first tab. */
export function ProjectFooterStatic(props: Props) {
  return <Footer {...props} from={null} />;
}

function Footer({ home, neighbours, part, from }: Props & { from: string | null }) {
  const tab = (TABS.some((t) => t.id === from) && neighbours[from as TabId] ? from : home) as TabId;
  const back = tab === "featured" ? "/work" : `/work?tab=${tab}`;
  const q = `?from=${tab}`;
  if (part === "back") {
    return (
      <Link href={back} className="work-back">
        {workCopy.backToWork}
      </Link>
    );
  }
  const n = neighbours[tab];
  return (
    <nav className="project-nav" aria-label="More work">
      {n?.prev ? (
        <Link href={`/work/${n.prev.slug}${q}`} className="project-nav-link prev" rel="prev">
          <span className="work-mono">← {workCopy.previous}</span>
          <span className="project-nav-title">{n.prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      <Link href={back} className="project-nav-back">
        {workCopy.backToWork}
      </Link>
      {n?.next ? (
        <Link href={`/work/${n.next.slug}${q}`} className="project-nav-link next" rel="next">
          <span className="work-mono">{workCopy.next} →</span>
          <span className="project-nav-title">{n.next.title}</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
