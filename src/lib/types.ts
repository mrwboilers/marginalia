// Core domain types for Marginalia.

/** A book of the Bible (metadata from the `books` table). */
export interface BookMeta {
  id: number;
  name: string;
  testament: 'OT' | 'NT';
  chapters: number;
}

/** A verse as loaded for display. */
export interface Verse {
  v: number;
  text: string;
  /** Words of Christ — rendered red when the red-letter toggle is on. */
  red?: boolean;
}

/** Cross-references for a verse (Treasury of Scripture Knowledge — Phase 2). */
export interface Xref {
  v: number;
  refs: string[];
}

/** A translator's marginal / alternate reading ("Or, ..."). */
export interface AltReading {
  v: number;
  note: string;
}

/** A full-text search hit. */
export interface SearchHit {
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
}

/** A Strong's-tagged text segment: a text run whose last word carries `s`. */
export interface StrongSeg {
  t: string;
  s?: string[];
}

/** A Strong's lexicon entry (trimmed). */
export interface LexEntry {
  /** Original-language word. */
  w: string;
  /** Transliteration. */
  t: string;
  /** Part of speech. */
  p: string;
  /** Strong's definition. */
  d: string;
  /** Outline of biblical usage. */
  u?: string;
}

/**
 * One of a day's three Bible Companion portions (Robert Roberts' reading plan).
 * `start` (+ bookId) is where a click navigates; `label` is the printed range;
 * `chapters` lists every chapter it spans. Verse fields appear only where the plan
 * splits a long chapter (Psalm 119).
 */
export interface CompanionPortion {
  bookId: number;
  book: string;
  label: string;
  start: number;
  chapters: number[];
  verseStart?: number;
  verseEnd?: number;
}

export type ToolMode = 'read' | 'highlight' | 'underline' | 'note' | 'erase';
export type MarkType = 'highlight' | 'underline';

/**
 * A user marking, anchored to a canonical reference + character range —
 * never to screen coordinates. This is what lets markings survive reflow,
 * font changes, resizing, and (at verse granularity) translation switches.
 */
export interface Mark {
  id: string;
  bookId: number;
  chapter: number;
  verse: number;
  /** Character offsets into the verse's plain text. */
  start: number;
  end: number;
  type: MarkType;
  color: string;
  layerId: string;
}

/** A margin note anchored to a verse. */
export interface Note {
  id: string;
  bookId: number;
  chapter: number;
  verse: number;
  /** Note content: plain text for `format: 'text'`, sanitized HTML for `'html'`. */
  body: string;
  /** Absent/`'text'` = legacy plain text; `'html'` = rich text (may embed images). */
  format?: 'text' | 'html';
  layerId: string;
}

/** A show/hide-able marking layer ("Study", "Sermon", ...). */
export interface Layer {
  id: string;
  name: string;
  /** Dot color in the layers panel. */
  color: string;
  visible: boolean;
}

/** The user's markings, loaded together. */
export interface UserData {
  layers: Layer[];
  marks: Mark[];
  notes: Note[];
}

/** The exportable/importable user-data bundle (the data-ownership promise). */
export interface MarkingsExport {
  version: 2;
  exportedAt: string;
  layers: Layer[];
  marks: Mark[];
  notes: Note[];
}

/** The six highlighter colors shown in the toolbar. */
export const HIGHLIGHT_COLORS = [
  { name: 'yellow', value: '#f6e05e' },
  { name: 'green', value: '#9ae6b4' },
  { name: 'blue', value: '#90cdf4' },
  { name: 'pink', value: '#fbb6ce' },
  { name: 'orange', value: '#fbd38d' },
  { name: 'purple', value: '#d6bcfa' },
] as const;
