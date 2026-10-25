# Work items

One Markdown file per item: `<slug>.md`, with the file name matching `slug`.
Add a file and it appears on /work and gets its own page at /work/<slug>; no
component changes. Field rules live in src/work/items.ts and are checked at
build time (a bad field fails the build and names the file).

- `status: draft` items show only in development (`npm run dev`, then "Show drafts" on /work).
- Flip to `status: published` to ship it. A published item may not contain "TODO".
- `tabs`: featured, built-with-ai, product-strategy, design, playground.
- `priority`: 1 = most relevant; live items with a metric sort first within a priority.
- Body: each `## Heading` becomes a section of the project page, in the order written.
  Sections left empty or "TODO" are skipped. Put images in `public/work/<slug>/`.
