import type { Xref } from '../types';

// Cross-references live as static per-book JSON (static/xrefs/<bookId>.json),
// bundled into the app so they work offline. Both providers read them the same way.
const cache = new Map<number, Record<string, Xref[]>>();

export async function loadChapterXrefs(bookId: number, chapter: number): Promise<Xref[]> {
  let book = cache.get(bookId);
  if (!book) {
    try {
      const res = await fetch(`/xrefs/${bookId}.json`);
      book = res.ok ? ((await res.json()) as Record<string, Xref[]>) : {};
    } catch {
      book = {};
    }
    cache.set(bookId, book);
  }
  return book[String(chapter)] ?? [];
}
