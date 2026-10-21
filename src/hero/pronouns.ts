/**
 * The recurring "I <-> we" flip. Once a step has settled, one pronoun somewhere
 * in the visible text briefly turns into its opposite (I -> we, we -> I,
 * my -> our, ...) with a glitch, then turns back. It blurs who is talking:
 * the human or the machine.
 */

const SWAP: Record<string, string> = {
  "I'm": "we're",
  "I've": "we've",
  "I'd": "we'd",
  "I'll": "we'll",
  I: "we",
  my: "our",
  My: "Our",
  me: "us",
  "We're": "I'm",
  "we're": "I'm",
  "We've": "I've",
  "we've": "I've",
  We: "I",
  we: "I",
  our: "my",
  Our: "My",
};

const WORDS = /\b(I'm|I've|I'd|I'll|We're|we're|We've|we've|I|We|we|my|My|our|Our|me)\b/g;

/** How many words in `text` can flip. */
export const flipCount = (text: string) => (text.match(WORDS) ?? []).length;

/** Split `text` around its k-th flippable word, with that word already flipped. */
export function flipAt(text: string, k: number): { before: string; word: string; after: string } | null {
  let i = 0;
  for (const m of text.matchAll(WORDS)) {
    if (i++ !== k || m.index === undefined) continue;
    const before = text.slice(0, m.index);
    let word = SWAP[m[0]] ?? m[0];
    // capitalise at the start of a sentence
    if (/(^|[.!?]\s+)$/.test(before)) word = word[0].toUpperCase() + word.slice(1);
    return { before, word, after: text.slice(m.index + m[0].length) };
  }
  return null;
}
