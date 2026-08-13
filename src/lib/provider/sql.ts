import Database from '@tauri-apps/plugin-sql';
import type { Bookmark, BookMeta, Layer, Mark, Note, SearchHit, UserData, Verse, Xref } from '../types';
import type { BibleProvider } from './index';
import { loadChapterXrefs } from './xrefs';

const TRANSLATION_ID = 1; // KJV

/** Notes store tags as a JSON array string; tolerate null/legacy values. */
function parseTags(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length ? arr : undefined;
  } catch {
    return undefined;
  }
}

/** SQLite-backed provider (the real, offline app). */
export class SqlProvider implements BibleProvider {
  private db!: Database;

  async init(): Promise<void> {
    // The Rust setup hook has already copied the bundled DB into app-config.
    this.db = await Database.load('sqlite:marginalia.db');
    // Migration for DBs copied before the Companion feature existed.
    await this.db.execute(
      `CREATE TABLE IF NOT EXISTS reading_progress (key TEXT PRIMARY KEY, done_at TEXT NOT NULL)`
    );
    // Migrations for DBs copied before newer note columns existed.
    const cols = await this.db.select<{ name: string }[]>(`PRAGMA table_info(notes)`);
    if (!cols.some((c) => c.name === 'format')) {
      await this.db.execute(`ALTER TABLE notes ADD COLUMN format TEXT`);
    }
    if (!cols.some((c) => c.name === 'tags')) {
      await this.db.execute(`ALTER TABLE notes ADD COLUMN tags TEXT`);
    }
    // Migration for DBs copied before bookmarks existed.
    await this.db.execute(
      `CREATE TABLE IF NOT EXISTS bookmarks (
         id TEXT PRIMARY KEY, book_id INTEGER NOT NULL, chapter INTEGER NOT NULL,
         label TEXT NOT NULL, created TEXT NOT NULL
       )`
    );
  }

  async books(): Promise<BookMeta[]> {
    return this.db.select<BookMeta[]>(
      `SELECT id, name, testament, chapters FROM books ORDER BY id`
    );
  }

  async chapter(bookId: number, chapter: number): Promise<Verse[]> {
    const rows = await this.db.select<{ v: number; text: string }[]>(
      `SELECT verse AS v, text FROM verses
       WHERE translation_id = $1 AND book_id = $2 AND chapter = $3
       ORDER BY verse`,
      [TRANSLATION_ID, bookId, chapter]
    );
    return rows.map((r) => ({ v: r.v, text: r.text }));
  }

  async xrefs(bookId: number, chapter: number): Promise<Xref[]> {
    return loadChapterXrefs(bookId, chapter);
  }

  async search(query: string, limit = 100): Promise<SearchHit[]> {
    const q = query.trim();
    if (!q) return [];
    // FTS5 prefix query; quote to tolerate punctuation.
    const match = q
      .split(/\s+/)
      .map((t) => `"${t.replace(/"/g, '')}"`)
      .join(' ');
    return this.db.select<SearchHit[]>(
      `SELECT b.id AS bookId, b.name AS bookName, v.chapter, v.verse, v.text
       FROM verses_fts f
       JOIN verses v ON v.id = f.rowid
       JOIN books b ON b.id = v.book_id
       WHERE f.text MATCH $1 AND v.translation_id = $2
       ORDER BY v.book_id, v.chapter, v.verse
       LIMIT $3`,
      [match, TRANSLATION_ID, limit]
    );
  }

  async loadUserData(): Promise<UserData> {
    const layers = await this.db.select<
      { id: string; name: string; color: string; visible: number }[]
    >(`SELECT id, name, color, visible FROM layers ORDER BY sort`);
    const marks = await this.db.select<
      {
        id: string; bookId: number; chapter: number; verse: number;
        start: number; end: number; type: string; color: string; layerId: string;
      }[]
    >(
      `SELECT id, book_id AS bookId, chapter, verse,
              start_char AS start, end_char AS end, type, color, layer_id AS layerId
       FROM marks`
    );
    const notes = await this.db.select<
      { id: string; bookId: number; chapter: number; verse: number; body: string; format: string | null; tags: string | null; layerId: string }[]
    >(`SELECT id, book_id AS bookId, chapter, verse, body, format, tags, layer_id AS layerId FROM notes`);

    return {
      layers: layers.map((l) => ({ ...l, visible: !!l.visible })),
      marks: marks as Mark[],
      notes: notes.map((n) => ({
        id: n.id,
        bookId: n.bookId,
        chapter: n.chapter,
        verse: n.verse,
        body: n.body,
        format: n.format === 'html' ? 'html' : 'text',
        tags: parseTags(n.tags),
        layerId: n.layerId,
      })) as Note[],
    };
  }

  async upsertMark(m: Mark): Promise<void> {
    const now = new Date().toISOString();
    await this.db.execute(
      `INSERT INTO marks (id, book_id, chapter, verse, start_char, end_char, type, color, layer_id, created, updated)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
       ON CONFLICT(id) DO UPDATE SET
         start_char=$5, end_char=$6, type=$7, color=$8, layer_id=$9, updated=$10`,
      [m.id, m.bookId, m.chapter, m.verse, m.start, m.end, m.type, m.color, m.layerId, now]
    );
  }

  async deleteMarks(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.db.execute(`DELETE FROM marks WHERE id = $1`, [id]);
    }
  }

  async upsertNote(n: Note): Promise<void> {
    const now = new Date().toISOString();
    const format = n.format ?? 'text';
    const tags = n.tags && n.tags.length ? JSON.stringify(n.tags) : null;
    await this.db.execute(
      `INSERT INTO notes (id, book_id, chapter, verse, body, format, tags, layer_id, created, updated)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
       ON CONFLICT(id) DO UPDATE SET body=$5, format=$6, tags=$7, layer_id=$8, updated=$9`,
      [n.id, n.bookId, n.chapter, n.verse, n.body, format, tags, n.layerId, now]
    );
  }

  async deleteNote(id: string): Promise<void> {
    await this.db.execute(`DELETE FROM notes WHERE id = $1`, [id]);
  }

  async setLayerVisible(id: string, visible: boolean): Promise<void> {
    await this.db.execute(`UPDATE layers SET visible = $1 WHERE id = $2`, [visible ? 1 : 0, id]);
  }

  async replaceLayers(layers: Layer[]): Promise<void> {
    await this.db.execute(`DELETE FROM layers`);
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      await this.db.execute(
        `INSERT INTO layers (id, name, color, visible, sort) VALUES ($1,$2,$3,$4,$5)`,
        [l.id, l.name, l.color, l.visible ? 1 : 0, i]
      );
    }
  }

  async replaceUserData(data: UserData): Promise<void> {
    await this.db.execute('BEGIN');
    try {
      await this.db.execute(`DELETE FROM marks`);
      await this.db.execute(`DELETE FROM notes`);
      await this.db.execute(`DELETE FROM layers`);
      for (let i = 0; i < data.layers.length; i++) {
        const l = data.layers[i];
        await this.db.execute(
          `INSERT INTO layers (id, name, color, visible, sort) VALUES ($1,$2,$3,$4,$5)`,
          [l.id, l.name, l.color, l.visible ? 1 : 0, i]
        );
      }
      for (const m of data.marks) await this.upsertMark(m);
      for (const n of data.notes) await this.upsertNote(n);
      await this.db.execute('COMMIT');
    } catch (e) {
      await this.db.execute('ROLLBACK');
      throw e;
    }
  }

  async loadReadingProgress(): Promise<string[]> {
    const rows = await this.db.select<{ key: string }[]>(`SELECT key FROM reading_progress`);
    return rows.map((r) => r.key);
  }

  async setReadingDone(key: string, done: boolean): Promise<void> {
    if (done) {
      await this.db.execute(
        `INSERT INTO reading_progress (key, done_at) VALUES ($1, $2)
         ON CONFLICT(key) DO UPDATE SET done_at = $2`,
        [key, new Date().toISOString()]
      );
    } else {
      await this.db.execute(`DELETE FROM reading_progress WHERE key = $1`, [key]);
    }
  }

  async replaceReadingProgress(keys: string[]): Promise<void> {
    await this.db.execute(`DELETE FROM reading_progress`);
    const now = new Date().toISOString();
    for (const key of keys) {
      await this.db.execute(`INSERT OR IGNORE INTO reading_progress (key, done_at) VALUES ($1, $2)`, [key, now]);
    }
  }

  async loadSettings(): Promise<Record<string, string>> {
    const rows = await this.db.select<{ key: string; value: string }[]>(`SELECT key, value FROM settings`);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async saveSetting(key: string, value: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT(key) DO UPDATE SET value = $2`,
      [key, value]
    );
  }

  async loadBookmarks(): Promise<Bookmark[]> {
    return this.db.select<Bookmark[]>(
      `SELECT id, book_id AS bookId, chapter, label, created FROM bookmarks ORDER BY book_id, chapter`
    );
  }

  async addBookmark(bm: Bookmark): Promise<void> {
    await this.db.execute(
      `INSERT INTO bookmarks (id, book_id, chapter, label, created) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT(id) DO UPDATE SET book_id=$2, chapter=$3, label=$4`,
      [bm.id, bm.bookId, bm.chapter, bm.label, bm.created]
    );
  }

  async deleteBookmark(id: string): Promise<void> {
    await this.db.execute(`DELETE FROM bookmarks WHERE id = $1`, [id]);
  }

  async replaceBookmarks(bms: Bookmark[]): Promise<void> {
    await this.db.execute(`DELETE FROM bookmarks`);
    for (const bm of bms) await this.addBookmark(bm);
  }
}
