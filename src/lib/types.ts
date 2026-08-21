// Core domain types for Marginalia.

/** A book of the Bible (metadata from the `books` table). */
export interface BookMeta {
  id: number;
  name: string;
  testament: 'OT' | 'NT';
  chapters: number;
}

/** The KJV translation id — the historical default and the value existing
 *  KJV-only markings are backfilled to. */
export const KJV_TRANSLATION_ID = 1;

/**
 * A Bible translation with the metadata needed to render it and to attribute /
 * license it accurately (the eventual "About → Bible Texts & Licenses" view is
 * generated from this). `publicDomain` is explicit rather than implied.
 */
export interface Translation {
  id: number;
  /** Short code, e.g. "KJV". */
  abbrev: string;
  name: string;
  /** ISO language code, e.g. "en". */
  language: string;
  publicDomain: boolean;
  /** Human-readable license name, e.g. "Public Domain", "CC BY-SA 4.0". */
  licenseName: string;
  licenseUrl?: string;
  copyright?: string;
  /** Attribution text a license may require us to display. */
  attribution?: string;
  /** Where the text came from (provenance). */
  sourceUrl?: string;
  /** Source text/version identifier, e.g. "eng-kjv2006". */
  textVersion?: string;
  /** Strong's numbers are available for this translation (KJV only for now). */
  hasStrongs: boolean;
  /** True when bundled/offline; false for a future remote-API translation. */
  isLocal: boolean;
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

/** A full-text search hit. Carries translation identity so a result is unambiguous. */
export interface SearchHit {
  translationId: number;
  translationAbbrev: string;
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
}

/** The same canonical verse fetched across several translations (Compare view). */
export interface VerseInTranslation {
  translationId: number;
  abbrev: string;
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
  /**
   * The translation this marking belongs to. Character offsets are wording-
   * specific, so a KJV highlight must NOT render against WEB/BSB/etc. Absent on
   * pre-multi-translation data — treat a missing value as KJV (see marksForVerse).
   */
  translationId: number;
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
  /** Topical tags for grouping/finding notes. */
  tags?: string[];
  layerId: string;
}

/** A saved place in the Bible (whole chapter). */
export interface Bookmark {
  id: string;
  bookId: number;
  chapter: number;
  /** Display label, e.g. "Genesis 1". */
  label: string;
  /** ISO timestamp. */
  created: string;
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
  /** 2 = markings only; 3 adds reading progress + bookmarks; 4 adds mark translationId. */
  version: 2 | 3 | 4;
  exportedAt: string;
  layers: Layer[];
  marks: Mark[];
  notes: Note[];
  readingProgress?: string[];
  bookmarks?: Bookmark[];
}

/** Distinct dot colors offered when creating/recoloring a mark layer. */
export const LAYER_COLORS = [
  '#d4a017', '#3182ce', '#38a169', '#d53f8c', '#dd6b20', '#805ad5', '#319795', '#e53e3e',
] as const;

/** The six highlighter colors shown in the toolbar. */
export const HIGHLIGHT_COLORS = [
  { name: 'yellow', value: '#f6e05e' },
  { name: 'green', value: '#9ae6b4' },
  { name: 'blue', value: '#90cdf4' },
  { name: 'pink', value: '#fbb6ce' },
  { name: 'orange', value: '#fbd38d' },
  { name: 'purple', value: '#d6bcfa' },
] as const;
