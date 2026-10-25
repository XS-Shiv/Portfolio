/** Until an item has its own cover, it borrows one of the monitor photos (always the same one per item). */
const DEFAULT_COVERS = ["/screen/three-quarter.webp", "/screen/side.webp", "/screen/back.webp"];

export function coverOf(slug: string) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return DEFAULT_COVERS[h % DEFAULT_COVERS.length];
}
