import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { site } from "@/hero/content";
import { SiteBar } from "@/site/SiteBar";
import { workCopy } from "@/work/config";
import { getItems } from "@/work/items";
import { WorkListing, WorkListingStatic } from "@/work/WorkListing";

export const metadata: Metadata = {
  title: `Work · ${site.name}`,
  description: workCopy.title,
};

export default function WorkPage() {
  const items = getItems();
  return (
    <>
      <SiteBar status="> /work_" />
      <main className="work-main">
        <Link href="/" className="work-back">
          {workCopy.back}
        </Link>
        <header className="work-head">
          <h1 className="work-title">{workCopy.title}</h1>
          <p className="work-mono">{workCopy.subline.replace(/_$/, "")}<span className="caret caret-block" /></p>
        </header>
        <Suspense fallback={<WorkListingStatic items={items} />}>
          <WorkListing items={items} />
        </Suspense>
      </main>
    </>
  );
}
