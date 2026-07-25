import type { LexEntry, StrongSeg } from '../types';

// Strong's word-tagging + lexicon live as static assets (static/strongs/), bundled
// into the app so they work offline. Loaded lazily and cached, like the xrefs.

const bookCache = new Map<number, Record<string, [number, StrongSeg[]][]>>();
let lexicon: Record<string, LexEntry> | null = null;
let lexiconPromise: Promise<Record<string, LexEntry>> | null = null;

async function loadBook(bookId: number): Promise<Record<string, [number, StrongSeg[]][]>> {
  const cached = bookCache.get(bookId);
  if (cached) return cached;
  let book: Record<string, [number, StrongSeg[]][]> = {};
  try {
    const res = await fetch(`/strongs/${bookId}.json`);
    if (res.ok) book = await res.json();
  } catch {
    /* keep empty on failure */
  }
  bookCache.set(bookId, book);
  return book;
}

/** Strong's segments for each verse of a chapter (verse number → segments). */
export async function loadStrongsChapter(
  bookId: number,
  chapter: number
): Promise<Map<number, StrongSeg[]>> {
  const book = await loadBook(bookId);
  const arr = book[String(chapter)] ?? [];
  return new Map(arr.map(([v, segs]) => [v, segs]));
}

/** The full Strong's lexicon (fetched once, cached). */
export async function loadLexicon(): Promise<Record<string, LexEntry>> {
  if (lexicon) return lexicon;
  if (!lexiconPromise) {
    lexiconPromise = fetch('/strongs/lexicon.json')
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  }
  lexicon = await lexiconPromise;
  return lexicon;
}

export async function getStrongDef(num: string): Promise<LexEntry | undefined> {
  const lex = await loadLexicon();
  return lex[num];
}
