import Database from '@tauri-apps/plugin-sql';
import type { BookMeta, Mark, Note, SearchHit, UserData, Verse, Xref } from '../types';
import type { BibleProvider } from './index';
import { loadChapterXrefs } from './xrefs';

const TRANSLATION_ID = 1; // KJV

/** SQLite-backed provider (the real, offline app). */
export class SqlProvider implements BibleProvider {
  private db!: Database;

  async init(): Promise<void> {
    // The Rust setup hook has already copied the bundled DB into app-config.
    this.db = await Database.load('sqlite:marginalia.db');
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
      { id: string; bookId: number; chapter: number; verse: number; body: string; layerId: string }[]
    >(`SELECT id, book_id AS bookId, chapter, verse, body, layer_id AS layerId FROM notes`);

    return {
      layers: layers.map((l) => ({ ...l, visible: !!l.visible })),
      marks: marks as Mark[],
      notes: notes as Note[],
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
    await this.db.execute(
      `INSERT INTO notes (id, book_id, chapter, verse, body, layer_id, created, updated)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
       ON CONFLICT(id) DO UPDATE SET body=$5, layer_id=$6, updated=$7`,
      [n.id, n.bookId, n.chapter, n.verse, n.body, n.layerId, now]
    );
  }

  async deleteNote(id: string): Promise<void> {
    await this.db.execute(`DELETE FROM notes WHERE id = $1`, [id]);
  }

  async setLayerVisible(id: string, visible: boolean): Promise<void> {
    await this.db.execute(`UPDATE layers SET visible = $1 WHERE id = $2`, [visible ? 1 : 0, id]);
  }

  async replaceUserData(data: UserData): Promise<void> {
    await this.db.execute(`DELETE FROM marks`);
    await this.db.execute(`DELETE FROM notes`);
    for (const m of data.marks) await this.upsertMark(m);
    for (const n of data.notes) await this.upsertNote(n);
    for (const l of data.layers) await this.setLayerVisible(l.id, l.visible);
  }
}
