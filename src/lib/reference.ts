import { BOOKS } from './books';

export interface RefTarget {
  bookId: number;
  chapter: number;
  verse?: number;
}

// Common abbreviations a reader might type that don't prefix-match the full name
// or the TSK abbreviation (e.g. "jn" for John). Book id -> aliases.
const ALIASES: Record<string, number> = {
  gen: 1, ex: 2, exo: 2, lev: 3, num: 4, deut: 5, dt: 5,
  josh: 6, jdg: 7, jgs: 7, sam: 9,
  song: 22, sos: 22, songs: 22, ecc: 21, qoh: 21,
  mt: 40, mat: 40, matt: 40, mk: 41, mrk: 41, mar: 41,
  lk: 42, luk: 42, jn: 43, jhn: 43, joh: 43,
  ac: 44, acts: 44, rom: 45, phil: 50, php: 50, philem: 57, phm: 57,
  col: 51, thess: 52, tim: 54, heb: 58, jas: 59, jm: 59,
  pet: 60, rev: 66, rv: 66, apoc: 66,
};

/** Resolve a (lowercased) book query like "1 john", "jn", "genesis" to a book id. */
function findBook(query: string): number | null {
  let q = query.trim().replace(/\s+/g, ' ');
  // Normalize numbered-book prefixes: "ii ", "1john" -> "2 ", "1 john".
  q = q
    .replace(/^iii\s*/, '3 ')
    .replace(/^ii\s*/, '2 ')
    .replace(/^i\s+/, '1 ')
    .replace(/^([1-3])(?=[a-z])/, '$1 ');
  if (!q) return null;

  const alias = ALIASES[q.replace(/ /g, '')];
  if (alias) return alias;

  const name = (b: (typeof BOOKS)[number]) => b.name.toLowerCase();
  const abbr = (b: (typeof BOOKS)[number]) => b.abbr.toLowerCase();

  return (
    BOOKS.find((b) => name(b) === q)?.id ??
    BOOKS.find((b) => abbr(b) === q)?.id ??
    BOOKS.find((b) => name(b).startsWith(q))?.id ??
    BOOKS.find((b) => name(b).replace(/ /g, '').startsWith(q.replace(/ /g, '')))?.id ??
    BOOKS.find((b) => abbr(b).startsWith(q))?.id ??
    null
  );
}

/**
 * Parse a free-typed reference into a navigable target. Handles full and
 * abbreviated book names, numbered books, missing spaces, and an optional
 * chapter[:verse] — e.g. "John 3:16", "1 jn 2", "1john2", "ps 23", "genesis".
 * With no chapter, defaults to chapter 1. Returns null if no book is recognized.
 */
export function parseReference(input: string): RefTarget | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;

  const m = s.match(/^(.*?) ?(\d+)(?::(\d+))?$/);
  if (m && /[a-z]/.test(m[1])) {
    const bookId = findBook(m[1]);
    if (!bookId) return null;
    return { bookId, chapter: Number(m[2]), verse: m[3] ? Number(m[3]) : undefined };
  }

  // No trailing chapter number — treat the whole input as a book name (chapter 1).
  if (!/[a-z]/.test(s)) return null;
  const bookId = findBook(s);
  return bookId ? { bookId, chapter: 1 } : null;
}
