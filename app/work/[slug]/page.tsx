import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { site } from "@/hero/content";
import { OutArrow, SiteBar } from "@/site/SiteBar";
import { KIND_LABEL, TABS, type TabId, workCopy } from "@/work/config";
import { coverOf } from "@/work/covers";
import { getItems, getPage } from "@/work/items";
import { ProjectFooter, ProjectFooterStatic, type Neighbours } from "@/work/ProjectFooter";

/** Only items known at build time get a page; drafts never do in production. */
export const dynamicParams = false;

export function generateStaticParams() {
  return getItems().map((i) => ({ slug: i.slug }));
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const item = getPage((await params).slug);
  if (!item) return {};
  const cover = item.cover ?? coverOf(item.slug);
  return {
    title: `${item.title} · ${site.name}`,
    description: item.oneLiner,
    openGraph: { title: item.title, description: item.oneLiner, images: [{ url: cover }] },
  };
}

export default async function ProjectPage({ params }: Params) {
  const { slug } = await params;
  const item = getPage(slug);
  if (!item) notFound();

  // previous / next within each tab the item belongs to; the footer picks the tab the visitor came from
  const all = getItems();
  const neighbours: Neighbours = {};
  for (const t of item.tabs) {
    const list = all.filter((i) => i.tabs.includes(t));
    const k = list.findIndex((i) => i.slug === slug);
    const pick = (i: number) => (list[i] ? { slug: list[i].slug, title: list[i].title } : null);
    neighbours[t] = { prev: pick(k - 1), next: pick(k + 1) };
  }
  const home = TABS.map((t) => t.id).find((t) => item.tabs.includes(t)) as TabId;

  const metrics = item.metrics ?? (item.metric ? [{ value: item.metric, label: "" }] : []);
  const facts = (
    [
      ["role", item.role],
      ["timeline", item.timeline],
      ["team", item.team],
      ["tools", item.tools?.join(", ")],
    ] as const
  ).filter(([, v]) => v);
  const links = (["live", "github", "deck"] as const).filter((k) => item.links?.[k]);

  return (
    <>
      <SiteBar status={`> /work/${slug}_`} />
      <main className="work-main project">
        <Suspense fallback={<ProjectFooterStatic home={home} neighbours={neighbours} part="back" />}>
          <ProjectFooter home={home} neighbours={neighbours} part="back" />
        </Suspense>

        <header className="project-hero">
          <div className="project-hero-text">
            <p className="work-mono">
              {KIND_LABEL[item.kind]}
              {item.status === "draft" && " · draft"}
            </p>
            <h1 className="project-title">{item.title}</h1>
            <p className="project-line">{item.oneLiner}</p>
            {facts.length > 0 && (
              <dl className="project-facts">
                {facts.map(([k, v]) => (
                  <div key={k}>
                    <dt>{workCopy.facts[k]}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            )}
            {links.length > 0 && (
              <div className="project-links">
                {links.map((k, i) => (
                  <a
                    key={k}
                    href={item.links![k]}
                    target="_blank"
                    rel="noreferrer"
                    className={i === 0 ? "project-link primary" : "project-link"}
                  >
                    {workCopy.links[k]}
                    <OutArrow size={15} />
                  </a>
                ))}
              </div>
            )}
          </div>
          <div className="project-cover">
            <Image src={item.cover ?? coverOf(item.slug)} alt="" fill priority sizes="(max-width: 900px) 100vw, 44vw" />
          </div>
        </header>

        {metrics.length > 0 && (
          <ul className="project-metrics">
            {metrics.map((m) => (
              <li key={m.value + m.label}>
                <span className="project-metric-value">{m.value}</span>
                {m.label && <span className="project-metric-label">{m.label}</span>}
              </li>
            ))}
          </ul>
        )}

        <div className="project-body">
          {item.sections.map((s) => (
            <section key={s.heading} className={/gallery/i.test(s.heading) ? "project-section gallery" : "project-section"}>
              <h2>{s.heading}</h2>
              <div className="prose" dangerouslySetInnerHTML={{ __html: s.html }} />
            </section>
          ))}
        </div>

        <Suspense fallback={<ProjectFooterStatic home={home} neighbours={neighbours} part="nav" />}>
          <ProjectFooter home={home} neighbours={neighbours} part="nav" />
        </Suspense>
      </main>
    </>
  );
}
