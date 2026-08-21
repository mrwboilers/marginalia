import type {
  Bookmark, BookMeta, Layer, Mark, Note, SearchHit, Translation,
  UserData, Verse, VerseInTranslation, Xref,
} from '../types';
import { KJV_TRANSLATION_ID } from '../types';
import { DEFAULT_LAYERS, type AllTranslations, type BibleProvider } from './index';
import { normalizeImportedMarks } from '../marks';
import { loadChapterXrefs } from './xrefs';
import { fetchEbibleVpl, type NormBook } from './web-vpl';

// Browser-dev mirrors the bundled translations registry (data/translations.mjs).
const KJV: Translation = {
  id: KJV_TRANSLATION_ID,
  abbrev: 'KJV',
  name: 'King James Version',
  language: 'en',
  publicDomain: true,
  licenseName: 'Public Domain',
  sourceUrl: 'https://github.com/aruljohn/Bible-kjv',
  textVersion: 'aruljohn/Bible-kjv',
  hasStrongs: true,
  isLocal: true,
};
const WEB: Translation = {
  id: 2,
  abbrev: 'WEB',
  name: 'World English Bible',
  language: 'en',
  publicDomain: true,
  licenseName: 'Public Domain',
  sourceUrl: 'https://ebible.org/eng-web/',
  textVersion: 'eng-web / engweb2025eb (eBible.org)',
  hasStrongs: false,
  isLocal: true,
};
const BSB: Translation = {
  id: 3,
  abbrev: 'BSB',
  name: 'Berean Standard Bible',
  language: 'en',
  publicDomain: true,
  licenseName: 'Public Domain',
  sourceUrl: 'https://ebible.org/engbsb/',
  textVersion: 'engbsb2020eb (eBible.org, BSB 3rd Printing; 2026-08-08)',
  hasStrongs: false,
  isLocal: true,
};
const YLT: Translation = {
  id: 4,
  abbrev: 'YLT',
  name: "Young's Literal Translation",
  language: 'en',
  publicDomain: true,
  licenseName: 'Public Domain',
  sourceUrl: 'https://ebible.org/engylt/',
  textVersion: 'engylt1898eb (eBible.org; Robert Young, 1898 Third Edition)',
  hasStrongs: false,
  isLocal: true,
};
const DEV_TRANSLATIONS = [KJV, WEB, BSB, YLT];

const BASE = 'https://raw.githubusercontent.com/aruljohn/Bible-kjv/master';
// eBible.org sends no CORS headers, so browser-dev fetches these through the Vite
// proxy configured in vite.config.js (see the `/ebible` entry). Each is one zip,
// fetched + unzipped + cached once. The packaged app uses the bundled DB instead.
const VPL_SOURCES: Record<number, { url: string; entry: string }> = {
  [WEB.id]: { url: '/ebible/Scriptures/eng-web_vpl.zip', entry: 'eng-web_vpl.txt' },
  [BSB.id]: { url: '/ebible/Scriptures/engbsb_vpl.zip', entry: 'engbsb_vpl.txt' },
  [YLT.id]: { url: '/ebible/Scriptures/engylt_vpl.zip', entry: 'engylt_vpl.txt' },
};
const STORE_KEY = 'marginalia.userdata.v2';
const PROGRESS_KEY = 'marginalia.companion.v1';
const SETTINGS_KEY = 'marginalia.settings.v1';
const BOOKMARKS_KEY = 'marginalia.bookmarks.v1';

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

// aruljohn (KJV) uses string chapter/verse; normalize to NormBook (numeric).
interface AruljohnBook {
  chapters: { chapter: string; verses: { verse: string; text: string }[] }[];
}

/** Browser-dev provider: content over HTTP, markings in localStorage. Online-only (dev). */
export class HttpProvider implements BibleProvider {
  private meta: BookMeta[] = [];
  private kjvCache = new Map<number, NormBook>(); // per-book (aruljohn), keyed by bookId
  // Whole-Bible VPL translations (WEB/BSB/YLT), each fetched + parsed once.
  private vplCache = new Map<number, Promise<Map<number, NormBook>>>();

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

  async translations(): Promise<Translation[]> {
    return DEV_TRANSLATIONS;
  }

  /** Fetch + normalize one book for a translation (cached). */
  private async loadBook(translationId: number, bookId: number): Promise<NormBook> {
    const vpl = VPL_SOURCES[translationId];
    if (vpl) {
      let all = this.vplCache.get(translationId);
      if (!all) this.vplCache.set(translationId, (all = fetchEbibleVpl(vpl.url, vpl.entry)));
      return (await all).get(bookId) ?? { chapters: [] };
    }
    const cached = this.kjvCache.get(bookId);
    if (cached) return cached;
    const name = this.meta[bookId - 1].name.replace(/\s+/g, '');
    const res = await fetch(`${BASE}/${name}.json`);
    if (!res.ok) throw new Error(`Failed to load ${name}: ${res.status}`);
    const data = (await res.json()) as AruljohnBook;
    const norm: NormBook = {
      chapters: data.chapters.map((c) => ({
        chapter: Number(c.chapter),
        verses: c.verses.map((v) => ({ verse: Number(v.verse), text: v.text })),
      })),
    };
    this.kjvCache.set(bookId, norm);
    return norm;
  }

  async chapter(translationId: number, bookId: number, chapter: number): Promise<Verse[]> {
    const data = await this.loadBook(translationId, bookId);
    const ch = data.chapters.find((c) => c.chapter === chapter);
    return (ch?.verses ?? []).map((v) => ({ v: v.verse, text: v.text }));
  }

  async compareVerse(bookId: number, chapter: number, verse: number): Promise<VerseInTranslation[]> {
    const out: VerseInTranslation[] = [];
    for (const t of DEV_TRANSLATIONS) {
      const verses = await this.chapter(t.id, bookId, chapter).catch(() => []);
      const v = verses.find((x) => x.v === verse);
      if (v) out.push({ translationId: t.id, abbrev: t.abbrev, text: v.text });
    }
    return out;
  }

  async xrefs(bookId: number, chapter: number): Promise<Xref[]> {
    return loadChapterXrefs(bookId, chapter);
  }

  async search(
    translationId: number | AllTranslations,
    query: string,
    limit = 100
  ): Promise<SearchHit[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const terms = q.split(/\s+/);
    const targets =
      translationId === 'all'
        ? DEV_TRANSLATIONS
        : DEV_TRANSLATIONS.filter((t) => t.id === translationId);
    const hits: SearchHit[] = [];
    // Dev-only: scan every book of each target translation (books are cached).
    for (const t of targets) {
      const books = await Promise.all(
        this.meta.map((b) => this.loadBook(t.id, b.id).then((data) => ({ b, data })).catch(() => null))
      );
      for (const entry of books) {
        if (!entry) continue;
        const { b, data } = entry;
        for (const ch of data.chapters) {
          for (const vs of ch.verses) {
            if (terms.every((term) => vs.text.toLowerCase().includes(term))) {
              hits.push({
                translationId: t.id, translationAbbrev: t.abbrev,
                bookId: b.id, bookName: b.name,
                chapter: ch.chapter, verse: vs.verse, text: vs.text,
              });
              if (hits.length >= limit) return hits;
            }
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
    const d = this.read();
    // Backfill marks saved before they carried a translation (treat as KJV).
    d.marks = normalizeImportedMarks(d.marks);
    return d;
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

  async replaceLayers(layers: Layer[]): Promise<void> {
    const d = this.read();
    d.layers = layers;
    this.write(d);
  }

  async replaceUserData(data: UserData): Promise<void> {
    this.write(data);
  }

  async loadReadingProgress(): Promise<string[]> {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (raw) return JSON.parse(raw) as string[];
    } catch { /* fall through */ }
    return [];
  }

  async setReadingDone(key: string, done: boolean): Promise<void> {
    const set = new Set(await this.loadReadingProgress());
    if (done) set.add(key);
    else set.delete(key);
    localStorage.setItem(PROGRESS_KEY, JSON.stringify([...set]));
  }

  async replaceReadingProgress(keys: string[]): Promise<void> {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(keys));
  }

  async loadSettings(): Promise<Record<string, string>> {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return JSON.parse(raw) as Record<string, string>;
    } catch { /* fall through */ }
    return {};
  }

  async saveSetting(key: string, value: string): Promise<void> {
    const s = await this.loadSettings();
    s[key] = value;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }

  async loadBookmarks(): Promise<Bookmark[]> {
    try {
      const raw = localStorage.getItem(BOOKMARKS_KEY);
      if (raw) return JSON.parse(raw) as Bookmark[];
    } catch { /* fall through */ }
    return [];
  }

  async addBookmark(bm: Bookmark): Promise<void> {
    const list = (await this.loadBookmarks()).filter((b) => b.id !== bm.id);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify([...list, bm]));
  }

  async deleteBookmark(id: string): Promise<void> {
    const list = (await this.loadBookmarks()).filter((b) => b.id !== id);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list));
  }

  async replaceBookmarks(bms: Bookmark[]): Promise<void> {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bms));
  }
}
