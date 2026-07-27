import type {
  BookMeta, CompanionPortion, Layer, Mark, MarkingsExport, Note, SearchHit, StrongSeg, ToolMode, Verse, Xref,
} from './types';
import { HIGHLIGHT_COLORS } from './types';
import { DEFAULT_LAYERS, getProvider, type BibleProvider } from './provider';
import { loadLexicon, loadStrongsChapter } from './provider/strongs';
import { companionKeys, companionLabel, keyFor, loadCompanion, readingsFor } from './provider/companion';
import { parseRef } from './books';

/** A rendered Strong's item: a styled text piece or a Strong's number marker. */
export type StrongItem = RenderPiece | { strongs: string[] };

const MIN_SCALE = 0.8;
const MAX_SCALE = 1.6;
const DEFAULT_BOOK = 43; // John
const DEFAULT_CHAPTER = 1;

/** A rendered slice of verse text with its resolved styling. */
export interface RenderPiece {
  text: string;
  highlight?: string;
  underline?: boolean;
  markIds: string[];
}

class AppState {
  private provider: BibleProvider | null = null;

  ready = $state(false);
  loadingChapter = $state(false);

  books = $state<BookMeta[]>([]);
  bookId = $state(DEFAULT_BOOK);
  chapter = $state(DEFAULT_CHAPTER);
  verses = $state<Verse[]>([]);
  xrefs = $state<Xref[]>([]);

  tool = $state<ToolMode>('read');
  color = $state<string>(HIGHLIGHT_COLORS[0].value);
  redLetter = $state(true);
  fontScale = $state(1);
  activeLayerId = $state('study');

  strongsOn = $state(false);
  strongsByVerse = $state<Map<number, StrongSeg[]>>(new Map());

  layers = $state<Layer[]>([]);
  marks = $state<Mark[]>([]);
  notes = $state<Note[]>([]);

  searchOpen = $state(false);
  searchQuery = $state('');
  searching = $state(false);
  searchResults = $state<SearchHit[]>([]);

  // Bible Companion (Robert Roberts' reading plan).
  companionOpen = $state(false);
  companionKey = $state('1-1');       // the day being viewed ("month-day")
  companionTodayKey = $state('1-1');  // the real current calendar day
  companionProgress = $state<Set<string>>(new Set());

  private noteTimers = new Map<string, ReturnType<typeof setTimeout>>();

  book = $derived(this.books.find((b) => b.id === this.bookId));

  visibleLayerIds = $derived(new Set(this.layers.filter((l) => l.visible).map((l) => l.id)));

  currentNotes = $derived(
    this.notes
      .filter((n) => n.bookId === this.bookId && n.chapter === this.chapter)
      .filter((n) => this.visibleLayerIds.has(n.layerId))
      .sort((a, b) => a.verse - b.verse)
  );

  companionReadings = $derived(readingsFor(this.companionKey));
  companionDateLabel = $derived(companionLabel(this.companionKey));
  companionIsToday = $derived(this.companionKey === this.companionTodayKey);
  companionDayDone = $derived(
    this.companionReadings.length > 0 &&
      this.companionReadings.every((_, i) => this.companionProgress.has(`${this.companionKey}:${i}`))
  );

  async init() {
    this.provider = await getProvider();
    this.books = await this.provider.books();
    const data = await this.provider.loadUserData();

    // Migration: collapse to the single Study layer (older DBs also had "Sermon").
    // Any markings on a removed layer are folded onto Study rather than orphaned.
    const KEEP = 'study';
    const dirty =
      !data.layers.some((l) => l.id === KEEP) ||
      data.layers.some((l) => l.id !== KEEP) ||
      data.marks.some((m) => m.layerId !== KEEP) ||
      data.notes.some((n) => n.layerId !== KEEP);
    if (dirty) {
      const study = data.layers.find((l) => l.id === KEEP) ?? DEFAULT_LAYERS[0];
      data.layers = [study];
      data.marks = data.marks.map((m) => (m.layerId === KEEP ? m : { ...m, layerId: KEEP }));
      data.notes = data.notes.map((n) => (n.layerId === KEEP ? n : { ...n, layerId: KEEP }));
      await this.provider.replaceUserData(data);
    }

    this.layers = data.layers;
    this.marks = data.marks;
    this.notes = data.notes;
    this.activeLayerId = KEEP;

    await loadCompanion();
    const now = new Date();
    this.companionTodayKey = keyFor(now.getMonth() + 1, now.getDate());
    this.companionKey = this.companionTodayKey;
    this.companionProgress = new Set(await this.provider.loadReadingProgress());

    await this.loadChapter(this.bookId, this.chapter);
    this.ready = true;
  }

  private async loadChapter(bookId: number, chapter: number) {
    if (!this.provider) return;
    this.loadingChapter = true;
    try {
      const [verses, xrefs] = await Promise.all([
        this.provider.chapter(bookId, chapter),
        this.provider.xrefs(bookId, chapter),
      ]);
      this.verses = verses;
      this.xrefs = xrefs;
      this.bookId = bookId;
      this.chapter = chapter;
      this.strongsByVerse = this.strongsOn
        ? await loadStrongsChapter(bookId, chapter)
        : new Map();
    } finally {
      this.loadingChapter = false;
    }
  }

  goTo(bookId: number, chapter: number) {
    void this.loadChapter(bookId, chapter);
  }

  canPrev = $derived(!(this.bookId === 1 && this.chapter === 1));
  canNext = $derived(
    !(this.bookId === this.books.length && this.chapter === (this.book?.chapters ?? 1))
  );

  prevChapter() {
    if (this.chapter > 1) return this.goTo(this.bookId, this.chapter - 1);
    const prev = this.books.find((b) => b.id === this.bookId - 1);
    if (prev) this.goTo(prev.id, prev.chapters);
  }

  nextChapter() {
    if (this.book && this.chapter < this.book.chapters) return this.goTo(this.bookId, this.chapter + 1);
    if (this.bookId < this.books.length) this.goTo(this.bookId + 1, 1);
  }

  setTool(t: ToolMode) {
    this.tool = t;
  }

  adjustFont(delta: number) {
    this.fontScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.fontScale + delta));
  }

  async toggleStrongs() {
    this.strongsOn = !this.strongsOn;
    if (this.strongsOn) {
      void loadLexicon();
      this.strongsByVerse = await loadStrongsChapter(this.bookId, this.chapter);
    } else {
      this.strongsByVerse = new Map();
    }
  }

  strongsFor(v: number): StrongSeg[] | undefined {
    return this.strongsByVerse.get(v);
  }

  toggleLayer(id: string) {
    let visible = false;
    this.layers = this.layers.map((l) => {
      if (l.id !== id) return l;
      visible = !l.visible;
      return { ...l, visible };
    });
    void this.provider?.setLayerVisible(id, visible);
  }

  noteFor(v: number): Note | undefined {
    return this.notes.find(
      (n) =>
        n.bookId === this.bookId &&
        n.chapter === this.chapter &&
        n.verse === v &&
        n.layerId === this.activeLayerId
    );
  }

  addMark(v: number, start: number, end: number) {
    if (this.tool !== 'highlight' && this.tool !== 'underline') return;
    if (end <= start) return;
    const mark: Mark = {
      id: crypto.randomUUID(),
      bookId: this.bookId,
      chapter: this.chapter,
      verse: v,
      start,
      end,
      type: this.tool,
      color: this.color,
      layerId: this.activeLayerId,
    };
    this.marks = [...this.marks, mark];
    void this.provider?.upsertMark(mark);
  }

  eraseMarks(ids: string[]) {
    if (!ids.length) return;
    const remove = new Set(ids);
    this.marks = this.marks.filter((m) => !remove.has(m.id));
    void this.provider?.deleteMarks(ids);
  }

  ensureNote(v: number): Note {
    const existing = this.noteFor(v);
    if (existing) return existing;
    const note: Note = {
      id: crypto.randomUUID(),
      bookId: this.bookId,
      chapter: this.chapter,
      verse: v,
      body: '',
      layerId: this.activeLayerId,
    };
    this.notes = [...this.notes, note];
    void this.provider?.upsertNote(note);
    return note;
  }

  updateNote(id: string, body: string) {
    let updated: Note | undefined;
    this.notes = this.notes.map((n) => {
      if (n.id !== id) return n;
      updated = { ...n, body };
      return updated;
    });
    if (!updated) return;
    // Debounce writes while typing.
    clearTimeout(this.noteTimers.get(id));
    this.noteTimers.set(
      id,
      setTimeout(() => this.provider?.upsertNote(updated!), 400)
    );
  }

  deleteNote(id: string) {
    this.notes = this.notes.filter((n) => n.id !== id);
    void this.provider?.deleteNote(id);
  }

  private applicableMarks(v: number): Mark[] {
    return this.marks.filter(
      (m) =>
        m.bookId === this.bookId &&
        m.chapter === this.chapter &&
        m.verse === v &&
        this.visibleLayerIds.has(m.layerId)
    );
  }

  /**
   * Resolve `text` (a slice of verse `v` starting at absolute `baseOffset`) into
   * styled pieces given the marks that apply. baseOffset lets Strong's segments
   * be styled correctly while marks stay anchored to whole-verse offsets.
   */
  private piecesForRange(v: number, baseOffset: number, text: string): RenderPiece[] {
    const len = text.length;
    const marks = this.applicableMarks(v).filter(
      (m) => m.end > baseOffset && m.start < baseOffset + len
    );
    if (!marks.length) return [{ text, markIds: [] }];

    const bounds = new Set<number>([0, len]);
    for (const m of marks) {
      bounds.add(Math.max(0, Math.min(len, m.start - baseOffset)));
      bounds.add(Math.max(0, Math.min(len, m.end - baseOffset)));
    }
    const points = [...bounds].sort((a, b) => a - b);

    const pieces: RenderPiece[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const s = points[i];
      const e = points[i + 1];
      if (e <= s) continue;
      const abs = baseOffset + s;
      const absE = baseOffset + e;
      const covering = marks.filter((m) => m.start <= abs && m.end >= absE);
      const highlight = covering.filter((m) => m.type === 'highlight').at(-1)?.color;
      const underline = covering.some((m) => m.type === 'underline');
      pieces.push({ text: text.slice(s, e), highlight, underline, markIds: covering.map((m) => m.id) });
    }
    return pieces;
  }

  renderVerse(v: number, text: string): RenderPiece[] {
    return this.piecesForRange(v, 0, text);
  }

  /** Render a verse with inline Strong's numbers, marks still applied. */
  renderStrongVerse(v: number): StrongItem[] {
    const segs = this.strongsByVerse.get(v);
    if (!segs) return [];
    const items: StrongItem[] = [];
    let off = 0;
    for (const seg of segs) {
      if (seg.t) {
        items.push(...this.piecesForRange(v, off, seg.t));
        off += seg.t.length;
      }
      if (seg.s && seg.s.length) items.push({ strongs: seg.s });
    }
    return items;
  }

  // --- Search -------------------------------------------------------------
  openSearch() {
    this.searchOpen = true;
  }
  closeSearch() {
    this.searchOpen = false;
  }
  async runSearch(query: string) {
    this.searchQuery = query;
    if (!query.trim() || !this.provider) {
      this.searchResults = [];
      return;
    }
    this.searching = true;
    try {
      this.searchResults = await this.provider.search(query, 200);
    } finally {
      this.searching = false;
    }
  }
  goToHit(hit: SearchHit) {
    this.searchOpen = false;
    this.goTo(hit.bookId, hit.chapter);
  }

  // --- Bible Companion -----------------------------------------------------
  openCompanion() {
    this.companionKey = this.companionTodayKey; // always land on today
    this.companionOpen = true;
  }
  closeCompanion() {
    this.companionOpen = false;
  }
  companionToday() {
    this.companionKey = this.companionTodayKey;
  }
  /** Step to the previous/next scheduled day, wrapping around the year. */
  companionStep(delta: number) {
    const keys = companionKeys();
    const i = keys.indexOf(this.companionKey);
    if (i < 0) return;
    this.companionKey = keys[(i + delta + keys.length) % keys.length];
  }
  isReadingDone(index: number): boolean {
    return this.companionProgress.has(`${this.companionKey}:${index}`);
  }
  toggleReadingDone(index: number) {
    const key = `${this.companionKey}:${index}`;
    const done = !this.companionProgress.has(key);
    const next = new Set(this.companionProgress);
    if (done) next.add(key);
    else next.delete(key);
    this.companionProgress = next;
    void this.provider?.setReadingDone(key, done);
  }
  /** Check or uncheck all of the current day's portions at once. */
  toggleDayDone() {
    const target = !this.companionDayDone;
    this.companionReadings.forEach((_, i) => {
      if (this.isReadingDone(i) !== target) this.toggleReadingDone(i);
    });
  }
  /** Open a portion in the reading view (navigates to its first chapter). */
  openReading(portion: CompanionPortion) {
    this.companionOpen = false;
    this.goTo(portion.bookId, portion.start);
  }

  // --- Cross-reference lookup (hover preview + click to navigate) ----------
  private refChapterCache = new Map<string, Verse[]>();

  private async chapterFor(bookId: number, chapter: number): Promise<Verse[]> {
    const key = `${bookId}:${chapter}`;
    let verses = this.refChapterCache.get(key);
    if (!verses && this.provider) {
      verses = await this.provider.chapter(bookId, chapter);
      this.refChapterCache.set(key, verses);
    }
    return verses ?? [];
  }

  /** Text of the passage a cross-reference points to, for a hover preview. */
  async refPreview(ref: string): Promise<{ ref: string; text: string } | null> {
    const p = parseRef(ref);
    if (!p || !this.provider) return null;

    const MAX_VERSES = 5;
    const single = p.chapter === p.endChapter && p.verse === p.endVerse;
    const parts: string[] = [];
    let count = 0;
    for (let c = p.chapter; c <= p.endChapter && count < MAX_VERSES; c++) {
      const verses = await this.chapterFor(p.bookId, c);
      const from = c === p.chapter ? p.verse : 1;
      const to = c === p.endChapter ? p.endVerse : Number.MAX_SAFE_INTEGER;
      for (const v of verses) {
        if (v.v < from || v.v > to) continue;
        parts.push(single ? v.text : `${v.v} ${v.text}`);
        if (++count >= MAX_VERSES) break;
      }
    }
    let text = parts.join(' ');
    if (!text) return null;
    if (text.length > 420) text = text.slice(0, 420).trimEnd() + '…';

    const label = single
      ? `${p.name} ${p.chapter}:${p.verse}`
      : p.endChapter !== p.chapter
        ? `${p.name} ${p.chapter}:${p.verse}–${p.endChapter}:${p.endVerse}`
        : `${p.name} ${p.chapter}:${p.verse}–${p.endVerse}`;
    return { ref: label, text };
  }

  /** Jump to the chapter a cross-reference points to. */
  goToRef(ref: string) {
    const p = parseRef(ref);
    if (p) this.goTo(p.bookId, p.chapter);
  }

  // --- Export / import ----------------------------------------------------
  exportJSON(): string {
    const data: MarkingsExport = {
      version: 2,
      exportedAt: new Date().toISOString(),
      layers: this.layers,
      marks: this.marks,
      notes: this.notes,
    };
    return JSON.stringify(data, null, 2);
  }

  async importJSON(raw: string) {
    const data = JSON.parse(raw) as MarkingsExport;
    if (data.version !== 2) throw new Error(`Unsupported export version: ${data.version}`);
    if (Array.isArray(data.layers) && data.layers.length) this.layers = data.layers;
    this.marks = Array.isArray(data.marks) ? data.marks : [];
    this.notes = Array.isArray(data.notes) ? data.notes : [];
    await this.provider?.replaceUserData({
      layers: this.layers,
      marks: this.marks,
      notes: this.notes,
    });
  }
}

export const app = new AppState();
