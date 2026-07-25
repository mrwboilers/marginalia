import type { BookMeta, Mark, Note, SearchHit, UserData, Verse, Xref } from '../types';
import { DEFAULT_LAYERS, type BibleProvider } from './index';
import { loadChapterXrefs } from './xrefs';

const BASE = 'https://raw.githubusercontent.com/aruljohn/Bible-kjv/master';
const STORE_KEY = 'marginalia.userdata.v2';

// Canonical KJV book order + chapter counts (avoids fetching all 66 books at startup).
const BOOKS: [string, number][] = [
  ['Genesis', 50], ['Exodus', 40], ['Leviticus', 27], ['Numbers', 36], ['Deuteronomy', 34],
  ['Joshua', 24], ['Judges', 21], ['Ruth', 4], ['1 Samuel', 31], ['2 Samuel', 24],
  ['1 Kings', 22], ['2 Kings', 25], ['1 Chronicles', 29], ['2 Chronicles', 36], ['Ezra', 10],
  ['Nehemiah', 13], ['Esther', 10], ['Job', 42], ['Psalms', 150], ['Proverbs', 31],
  ['Ecclesiastes', 12], ['Song of Solomon', 8], ['Isaiah', 66], ['Jeremiah', 52], ['Lamentations', 5],
  ['Ezekiel', 48], ['Daniel', 12], ['Hosea', 14], ['Joel', 3], ['Amos', 9],
  ['Obadiah', 1], ['Jonah', 4], ['Micah', 7], ['Nahum', 3], ['Habakkuk', 3],
  ['Zephaniah', 3], ['Haggai', 2], ['Zechariah', 14], ['Malachi', 4], ['Matthew', 28],
  ['Mark', 16], ['Luke', 24], ['John', 21], ['Acts', 28], ['Romans', 16],
  ['1 Corinthians', 16], ['2 Corinthians', 13], ['Galatians', 6], ['Ephesians', 6], ['Philippians', 4],
  ['Colossians', 4], ['1 Thessalonians', 5], ['2 Thessalonians', 3], ['1 Timothy', 6], ['2 Timothy', 4],
  ['Titus', 3], ['Philemon', 1], ['Hebrews', 13], ['James', 5], ['1 Peter', 5],
  ['2 Peter', 3], ['1 John', 5], ['2 John', 1], ['3 John', 1], ['Jude', 1],
  ['Revelation', 22],
];

interface RawBook {
  chapters: { chapter: string; verses: { verse: string; text: string }[] }[];
}

/** Browser-dev provider: KJV over HTTP, markings in localStorage. Online-only (dev). */
export class HttpProvider implements BibleProvider {
  private meta: BookMeta[] = [];
  private bookCache = new Map<number, RawBook>();

  async init(): Promise<void> {
    this.meta = BOOKS.map(([name, chapters], i) => ({
      id: i + 1,
      name,
      testament: i < 39 ? 'OT' : 'NT',
      chapters,
    }));
  }

  async books(): Promise<BookMeta[]> {
    return this.meta;
  }

  private async raw(bookId: number): Promise<RawBook> {
    const cached = this.bookCache.get(bookId);
    if (cached) return cached;
    const name = this.meta[bookId - 1].name.replace(/\s+/g, '');
    const res = await fetch(`${BASE}/${name}.json`);
    if (!res.ok) throw new Error(`Failed to load ${name}: ${res.status}`);
    const data = (await res.json()) as RawBook;
    this.bookCache.set(bookId, data);
    return data;
  }

  async chapter(bookId: number, chapter: number): Promise<Verse[]> {
    const data = await this.raw(bookId);
    const ch = data.chapters.find((c) => Number(c.chapter) === chapter);
    return (ch?.verses ?? []).map((v) => ({ v: Number(v.verse), text: v.text }));
  }

  async xrefs(bookId: number, chapter: number): Promise<Xref[]> {
    return loadChapterXrefs(bookId, chapter);
  }

  async search(query: string, limit = 100): Promise<SearchHit[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const terms = q.split(/\s+/);
    // Dev-only: fetch all books (cached) and scan.
    await Promise.all(this.meta.map((b) => this.raw(b.id).catch(() => null)));
    const hits: SearchHit[] = [];
    for (const b of this.meta) {
      const data = this.bookCache.get(b.id);
      if (!data) continue;
      for (const ch of data.chapters) {
        for (const vs of ch.verses) {
          const lower = vs.text.toLowerCase();
          if (terms.every((t) => lower.includes(t))) {
            hits.push({
              bookId: b.id, bookName: b.name,
              chapter: Number(ch.chapter), verse: Number(vs.verse), text: vs.text,
            });
            if (hits.length >= limit) return hits;
          }
        }
      }
    }
    return hits;
  }

  private read(): UserData {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw) as UserData;
    } catch { /* fall through to defaults */ }
    return { layers: structuredClone(DEFAULT_LAYERS), marks: [], notes: [] };
  }

  private write(data: UserData): void {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  }

  async loadUserData(): Promise<UserData> {
    return this.read();
  }

  async upsertMark(m: Mark): Promise<void> {
    const d = this.read();
    d.marks = [...d.marks.filter((x) => x.id !== m.id), m];
    this.write(d);
  }

  async deleteMarks(ids: string[]): Promise<void> {
    const d = this.read();
    const set = new Set(ids);
    d.marks = d.marks.filter((x) => !set.has(x.id));
    this.write(d);
  }

  async upsertNote(n: Note): Promise<void> {
    const d = this.read();
    d.notes = [...d.notes.filter((x) => x.id !== n.id), n];
    this.write(d);
  }

  async deleteNote(id: string): Promise<void> {
    const d = this.read();
    d.notes = d.notes.filter((x) => x.id !== id);
    this.write(d);
  }

  async setLayerVisible(id: string, visible: boolean): Promise<void> {
    const d = this.read();
    d.layers = d.layers.map((l) => (l.id === id ? { ...l, visible } : l));
    this.write(d);
  }

  async replaceUserData(data: UserData): Promise<void> {
    this.write(data);
  }
}
