import type { Note } from './types';
import { htmlToPlainText } from './richtext';

/** A hit when searching the user's own notes. */
export interface NoteHit {
  noteId: string;
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
  /** A plain-text excerpt of the note around the first match. */
  snippet: string;
  tags: string[];
}

/** The searchable plain text of a note (HTML stripped for rich notes). */
export function noteText(note: Note): string {
  return note.format === 'html' ? htmlToPlainText(note.body) : note.body;
}

/**
 * Build a short excerpt of `text` centered on the earliest match of any `term`,
 * with ellipses where it was trimmed. Terms are matched case-insensitively.
 */
export function makeSnippet(text: string, terms: string[], max = 140): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;

  const lower = clean.toLowerCase();
  let first = -1;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i !== -1 && (first === -1 || i < first)) first = i;
  }
  if (first === -1) return clean.slice(0, max).trimEnd() + '…';

  // Center the window on the match, then snap to word boundaries.
  let start = Math.max(0, first - Math.floor(max / 3));
  let end = Math.min(clean.length, start + max);
  start = end - max > 0 ? end - max : start;
  if (start > 0) {
    const sp = clean.indexOf(' ', start);
    if (sp !== -1 && sp < first) start = sp + 1;
  }
  let out = clean.slice(start, end).trim();
  if (start > 0) out = '…' + out;
  if (end < clean.length) out = out + '…';
  return out;
}

/**
 * Search notes by text content and/or a tag. All whitespace-separated query
 * terms must be present (AND, matched against the note text and its tags); if
 * `tag` is given, the note must also carry that tag. With neither a query nor a
 * tag, nothing matches. Results are in canonical order.
 */
export function matchNotes(
  notes: Note[],
  query: string,
  bookName: (bookId: number) => string,
  tag?: string | null
): NoteHit[] {
  const q = query.trim().toLowerCase();
  const terms = q ? q.split(/\s+/) : [];
  if (!terms.length && !tag) return [];

  const hits: NoteHit[] = [];
  for (const note of notes) {
    const tags = note.tags ?? [];
    if (tag && !tags.includes(tag)) continue;
    const text = noteText(note);
    if (!text && !tags.length) continue;
    if (terms.length) {
      const searchable = `${text} ${tags.join(' ')}`.toLowerCase();
      if (!terms.every((t) => searchable.includes(t))) continue;
    }
    hits.push({
      noteId: note.id,
      bookId: note.bookId,
      bookName: bookName(note.bookId),
      chapter: note.chapter,
      verse: note.verse,
      snippet: makeSnippet(text, terms),
      tags,
    });
  }
  hits.sort((a, b) => a.bookId - b.bookId || a.chapter - b.chapter || a.verse - b.verse);
  return hits;
}
