"use client";

import { domAnimation, LazyMotion, m as motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Arrow, OutArrow } from "@/site/SiteBar";
import { DESIGN_TYPES, type DesignType, KIND_LABEL, TAB_TAG, TABS, type TabId, WORK_MOTION, workCopy } from "./config";
import { coverOf } from "./covers";
import { visibleTabs, type WorkItem } from "./model";

const DEV = process.env.NODE_ENV === "development";

type Props = { items: WorkItem[] };

/** The routed listing: the tab and the Design filter live in the URL (?tab=, ?type=). */
export function WorkListing({ items }: Props) {
  const params = useSearchParams();
  return <Listing items={items} tabParam={params.get("tab")} typeParam={params.get("type")} routed />;
}

/** Same listing for the prerendered first paint (default tab), before the URL is read. */
export function WorkListingStatic({ items }: Props) {
  return <Listing items={items} tabParam={null} typeParam={null} routed={false} />;
}

function setUrl(tab: TabId, type: DesignType | null, first: TabId) {
  const q = new URLSearchParams();
  if (tab !== first) q.set("tab", tab);
  if (tab === "design" && type) q.set("type", type);
  const s = q.toString();
  window.history.pushState(null, "", s ? `/work?${s}` : "/work");
}

function Listing({
  items,
  tabParam,
  typeParam,
  routed,
}: Props & { tabParam: string | null; typeParam: string | null; routed: boolean }) {
  const reduced = useReducedMotion();
  const [showDrafts, setShowDrafts] = useState(false);
  const shown = DEV && showDrafts ? items : items.filter((i) => i.status === "published");
  const tabs = visibleTabs(shown);
  const active = (tabs.find((t) => t === tabParam) ?? tabs[0]) as TabId | undefined;
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const inTab = active ? shown.filter((i) => i.tabs.includes(active)) : [];
  const types = active === "design" ? DESIGN_TYPES.filter((d) => inTab.some((i) => i.designType === d.id)) : [];
  const type = types.find((d) => d.id === typeParam)?.id ?? null;
  const list = type ? inTab.filter((i) => i.designType === type) : inTab;

  const select = (tab: TabId, nextType: DesignType | null = null) => {
    if (!routed || !tabs.length) return;
    setUrl(tab, nextType, tabs[0]);
  };

  // arrow keys move between tabs (and select them), as in the ARIA tabs pattern
  const onKey = (e: React.KeyboardEvent) => {
    if (!active) return;
    const i = tabs.indexOf(active);
    const to =
      e.key === "ArrowRight" ? tabs[(i + 1) % tabs.length]
      : e.key === "ArrowLeft" ? tabs[(i - 1 + tabs.length) % tabs.length]
      : e.key === "Home" ? tabs[0]
      : e.key === "End" ? tabs[tabs.length - 1]
      : null;
    if (!to) return;
    e.preventDefault();
    select(to);
    tabRefs.current[to]?.focus();
  };

  // keep the active tab in view in the phone's scrolling chip row
  useEffect(() => {
    if (active) tabRefs.current[active]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <LazyMotion features={domAnimation} strict>
      {DEV && (
        <label className="work-drafts">
          <input type="checkbox" checked={showDrafts} onChange={(e) => setShowDrafts(e.target.checked)} />
          Show drafts <span>(development only)</span>
        </label>
      )}

      {!active ? (
        <div className="work-empty">
          <p className="work-mono">{workCopy.empty.status}</p>
          <p className="work-empty-title">{workCopy.empty.title}</p>
          <p className="work-empty-line">{workCopy.empty.line}</p>
        </div>
      ) : (
        <>
          <div className="work-tabs" role="tablist" aria-label="Work" onKeyDown={onKey}>
            {tabs.map((t) => (
              <button
                key={t}
                ref={(el) => {
                  tabRefs.current[t] = el;
                }}
                id={`tab-${t}`}
                type="button"
                role="tab"
                className="work-tab"
                aria-selected={t === active}
                aria-controls={`panel-${t}`}
                tabIndex={t === active ? 0 : -1}
                onClick={() => select(t)}
              >
                {TABS.find((x) => x.id === t)!.label}
              </button>
            ))}
          </div>

          <div id={`panel-${active}`} role="tabpanel" aria-labelledby={`tab-${active}`} className="work-panel">
            {types.length > 1 && (
              <div className="work-chips" role="group" aria-label="Filter design work">
                {[{ id: null, label: "All" }, ...types].map((d) => (
                  <button
                    key={d.label}
                    type="button"
                    className="work-chip"
                    aria-pressed={type === d.id}
                    onClick={() => select("design", d.id as DesignType | null)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}
            <motion.ul
              key={`${active}-${type ?? "all"}`}
              className="work-grid"
              initial={reduced ? false : { opacity: 0, y: WORK_MOTION.tabSlide }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: WORK_MOTION.tabSwitch / 1000, ease: [0.22, 1, 0.36, 1] }}
            >
              {list.map((item, i) => (
                <li key={item.slug}>
                  <WorkCard item={item} n={i + 1} from={active} reduced={!!reduced} />
                </li>
              ))}
            </motion.ul>
          </div>
        </>
      )}
    </LazyMotion>
  );
}

function WorkCard({ item, n, from, reduced }: { item: WorkItem; n: number; from: TabId; reduced: boolean }) {
  const tag = item.designType
    ? DESIGN_TYPES.find((d) => d.id === item.designType)!.label
    : TAB_TAG[item.tabs.find((t) => t !== "featured") ?? item.tabs[0]];
  const href = `/work/${item.slug}?from=${from}`;
  const [focused, setFocused] = useState(false);
  const lift = reduced ? 0 : -WORK_MOTION.cardLift;
  return (
    <motion.article
      className={`work-card${item.status === "draft" ? " is-draft" : ""}`}
      animate={{ y: focused ? lift : 0 }}
      whileHover={{ y: lift }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <Image className="work-card-img" src={item.cover ?? coverOf(item.slug)} alt="" fill sizes="(max-width: 720px) 60vw, 240px" />
      <p className="work-card-num" aria-hidden>
        {String(n).padStart(2, "0")} <span className="work-dash" />
      </p>
      <h2 className="work-card-title">
        {/* the title link stretches over the whole card */}
        <Link href={href}>{item.title}</Link>
      </h2>
      <p className="work-card-line">{item.oneLiner}</p>
      <div className="work-card-chips">
        {item.metric && <span className="work-metric">{item.metric}</span>}
        <span className={`work-kind kind-${item.kind}`}>{KIND_LABEL[item.kind]}</span>
        <span className="work-tag">{tag}</span>
        {item.status === "draft" && <span className="work-tag">Draft</span>}
      </div>
      {item.kind === "live" && item.links?.live && (
        <a className="work-live" href={item.links.live} target="_blank" rel="noreferrer" aria-label={`${item.title}: live site`}>
          <OutArrow size={14} />
        </a>
      )}
      <span className="work-card-arrow" aria-hidden>
        <Arrow size={16} />
      </span>
    </motion.article>
  );
}
