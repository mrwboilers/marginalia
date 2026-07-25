import type { BookMeta, Layer, Mark, Note, SearchHit, UserData, Verse, Xref } from '../types';

/**
 * Storage/content backend. Two implementations:
 *   - SqlProvider   — the real app: bundled SQLite (KJV + FTS) via tauri-plugin-sql.
 *   - HttpProvider  — browser dev only: fetches KJV over HTTP, markings in localStorage.
 * The rest of the app talks only to this interface (the roadmap's provider design).
 */
export interface BibleProvider {
  init(): Promise<void>;
  books(): Promise<BookMeta[]>;
  chapter(bookId: number, chapter: number): Promise<Verse[]>;
  xrefs(bookId: number, chapter: number): Promise<Xref[]>;
  search(query: string, limit?: number): Promise<SearchHit[]>;

  loadUserData(): Promise<UserData>;
  upsertMark(mark: Mark): Promise<void>;
  deleteMarks(ids: string[]): Promise<void>;
  upsertNote(note: Note): Promise<void>;
  deleteNote(id: string): Promise<void>;
  setLayerVisible(id: string, visible: boolean): Promise<void>;
  replaceUserData(data: UserData): Promise<void>;
}

export const DEFAULT_LAYERS: Layer[] = [
  { id: 'study', name: 'Study', color: '#d4a017', visible: true },
  { id: 'sermon', name: 'Sermon', color: '#4a90d9', visible: true },
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
