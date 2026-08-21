import type {
  Bookmark, BookMeta, Layer, Mark, Note, SearchHit, Translation,
  UserData, Verse, VerseInTranslation, Xref,
} from '../types';

/** Search every translation rather than one (widened `WHERE`). */
export type AllTranslations = 'all';

/**
 * Storage/content backend. Two implementations:
 *   - SqlProvider   — the real app: bundled SQLite (KJV + FTS) via tauri-plugin-sql.
 *   - HttpProvider  — browser dev only: fetches KJV over HTTP, markings in localStorage.
 * The rest of the app talks only to this interface (the roadmap's provider design).
 *
 * Content methods are translation-scoped; user-data methods are translation-agnostic
 * because notes/bookmarks/progress anchor to canonical references. Book metadata is
 * shared across translations (they use the same 66-book canon for now).
 */
export interface BibleProvider {
  init(): Promise<void>;
  books(): Promise<BookMeta[]>;
  translations(): Promise<Translation[]>;
  chapter(translationId: number, bookId: number, chapter: number): Promise<Verse[]>;
  xrefs(bookId: number, chapter: number): Promise<Xref[]>;
  search(translationId: number | AllTranslations, query: string, limit?: number): Promise<SearchHit[]>;
  /** The same canonical verse across every local translation (Compare view). */
  compareVerse(bookId: number, chapter: number, verse: number): Promise<VerseInTranslation[]>;

  loadUserData(): Promise<UserData>;
  upsertMark(mark: Mark): Promise<void>;
  deleteMarks(ids: string[]): Promise<void>;
  upsertNote(note: Note): Promise<void>;
  deleteNote(id: string): Promise<void>;
  setLayerVisible(id: string, visible: boolean): Promise<void>;
  replaceLayers(layers: Layer[]): Promise<void>;
  replaceUserData(data: UserData): Promise<void>;

  // Bible Companion reading progress: a flat set of "done" portion keys
  // ("<month>-<day>:<portionIndex>"), stored separately from markings.
  loadReadingProgress(): Promise<string[]>;
  setReadingDone(key: string, done: boolean): Promise<void>;
  replaceReadingProgress(keys: string[]): Promise<void>;

  // Small key/value settings (last position, font size, …).
  loadSettings(): Promise<Record<string, string>>;
  saveSetting(key: string, value: string): Promise<void>;

  // Saved places.
  loadBookmarks(): Promise<Bookmark[]>;
  addBookmark(bm: Bookmark): Promise<void>;
  deleteBookmark(id: string): Promise<void>;
  replaceBookmarks(bms: Bookmark[]): Promise<void>;
}

export const DEFAULT_LAYERS: Layer[] = [
  { id: 'study', name: 'Study', color: '#d4a017', visible: true },
];

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

let cached: BibleProvider | null = null;

/** Pick the backend for the current runtime (SQLite in-app, HTTP in the browser). */
export async function getProvider(): Promise<BibleProvider> {
  if (cached) return cached;
  if (isTauri()) {
    const { SqlProvider } = await import('./sql');
    cached = new SqlProvider();
  } else {
    const { HttpProvider } = await import('./http');
    cached = new HttpProvider();
  }
  await cached.init();
  return cached;
}
