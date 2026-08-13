import type {
  Bookmark, BookMeta, CompanionPortion, Layer, Mark, MarkingsExport, Note, SearchHit, StrongSeg, ToolMode, Verse, Xref,
} from './types';
import { HIGHLIGHT_COLORS, LAYER_COLORS } from './types';
import { DEFAULT_LAYERS, getProvider, type BibleProvider } from './provider';
import { loadLexicon, loadStrongsChapter } from './provider/strongs';
import { companionKeys, companionLabel, keyFor, loadCompanion, readingsFor } from './provider/companion';
import { matchNotes, type NoteHit } from './notesearch';
import { renderPieces, type RenderPiece } from './marks';
import { parseRef } from './books';

export type { RenderPiece } from './marks';

/** A rendered Strong's item: a styled text piece or a Strong's number marker. */
export type StrongItem = RenderPiece | { strongs: string[] };

const MIN_SCALE = 0.8;
const MAX_SCALE = 1.6;
const DEFAULT_BOOK = 43; // John
const DEFAULT_CHAPTER = 1;

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
  searchMode = $state<'scripture' | 'notes'>('scripture');
  noteResults = $state<NoteHit[]>([]);
  noteTagFilter = $state<string | null>(null);
  allNoteTags = $derived([...new Set(this.notes.flatMap((n) => n.tags ?? []))].sort());

  bookmarks = $state<Bookmark[]>([]);
  bookmarksOpen = $state(false);
  layersOpen = $state(false);

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

  isBookmarked = $derived(
    this.bookmarks.some((b) => b.bookId === this.bookId && b.chapter === this.chapter)
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

    this.layers = data.layers.length ? data.layers : structuredClone(DEFAULT_LAYERS);
    this.marks = data.marks;
    this.notes = data.notes;
    this.activeLayerId = this.layers[0].id;

    await loadCompanion();
    const now = new Date();
    this.companionTodayKey = keyFor(now.getMonth() + 1, now.getDate());
    this.companionKey = this.companionTodayKey;
    this.companionProgress = new Set(await this.provider.loadReadingProgress());

    // Restore bookmarks and the last-read position / font size.
    this.bookmarks = await this.provider.loadBookmarks();
    const settings = await this.provider.loadSettings();
    const [lastBook, lastChapter] = (settings.lastRef ?? '').split(':').map(Number);
    if (lastBook && lastChapter && this.books.some((b) => b.id === lastBook)) {
      this.bookId = lastBook;
      this.chapter = lastChapter;
    }
    if (settings.fontScale) {
      this.fontScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(settings.fontScale)));
    }
    if (settings.activeLayer && this.layers.some((l) => l.id === settings.activeLayer)) {
      this.activeLayerId = settings.activeLayer;
    }

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
      // Remember where we are so the app reopens here next time. One key (not two)
      // so the read-modify-write can't race and drop half the position.
      void this.provider.saveSetting('lastRef', `${bookId}:${chapter}`);
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
    void this.provider?.saveSetting('fontScale', String(this.fontScale));
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

  setActiveLayer(id: string) {
    this.activeLayerId = id;
    void this.provider?.saveSetting('activeLayer', id);
  }

  /** Create a new layer (next unused palette color) and make it active. */
  addLayer() {
    const used = new Set(this.layers.map((l) => l.color));
    const color = LAYER_COLORS.find((c) => !used.has(c)) ?? LAYER_COLORS[this.layers.length % LAYER_COLORS.length];
    const layer: Layer = { id: crypto.randomUUID(), name: `Layer ${this.layers.length + 1}`, color, visible: true };
    this.layers = [...this.layers, layer];
    void this.provider?.replaceLayers(this.layers);
    this.setActiveLayer(layer.id);
  }

  renameLayer(id: string, name: string) {
    this.layers = this.layers.map((l) => (l.id === id ? { ...l, name } : l));
    void this.provider?.replaceLayers(this.layers);
  }

  setLayerColor(id: string, color: string) {
    this.layers = this.layers.map((l) => (l.id === id ? { ...l, color } : l));
    void this.provider?.replaceLayers(this.layers);
  }

  /** Delete a layer along with its marks and notes (never the last remaining layer). */
  deleteLayer(id: string) {
    if (this.layers.length <= 1) return;
    const removeMarks = this.marks.filter((m) => m.layerId === id).map((m) => m.id);
    const removeNotes = this.notes.filter((n) => n.layerId === id).map((n) => n.id);
    this.marks = this.marks.filter((m) => m.layerId !== id);
    this.notes = this.notes.filter((n) => n.layerId !== id);
    this.layers = this.layers.filter((l) => l.id !== id);
    void this.provider?.deleteMarks(removeMarks);
    for (const nid of removeNotes) void this.provider?.deleteNote(nid);
    void this.provider?.replaceLayers(this.layers);
    if (this.activeLayerId === id) this.setActiveLayer(this.layers[0].id);
  }

  openLayers() {
    this.layersOpen = true;
  }
  closeLayers() {
    this.layersOpen = false;
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
      format: 'html', // new notes are rich text; legacy notes stay 'text'
      layerId: this.activeLayerId,
    };
    this.notes = [...this.notes, note];
    void this.provider?.upsertNote(note);
    return note;
  }

  updateNote(id: string, body: string, format: 'text' | 'html' = 'html') {
    let updated: Note | undefined;
    this.notes = this.notes.map((n) => {
      if (n.id !== id) return n;
      updated = { ...n, body, format };
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

  setNoteTags(id: string, tags: string[]) {
    // Normalize: trim, drop blanks, de-dupe (case-insensitively, keeping first form).
    const seen = new Set<string>();
    const clean = tags
      .map((t) => t.trim())
      .filter((t) => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()));
    let updated: Note | undefined;
    this.notes = this.notes.map((n) => {
      if (n.id !== id) return n;
      updated = { ...n, tags: clean };
      return updated;
    });
    if (updated) void this.provider?.upsertNote(updated);
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
    return renderPieces(baseOffset, text, this.applicableMarks(v));
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
    if (this.searchMode === 'notes') {
      this.runNoteSearch(query);
      return;
    }
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
  /** Search the user's own notes (in memory — no provider round-trip). */
  runNoteSearch(query: string) {
    this.noteResults = matchNotes(
      this.notes,
      query,
      (id) => this.books.find((b) => b.id === id)?.name ?? '',
      this.noteTagFilter
    );
  }
  /** Toggle a tag filter in the notes search and re-run. */
  setNoteTagFilter(tag: string | null) {
    this.noteTagFilter = this.noteTagFilter === tag ? null : tag;
    this.runNoteSearch(this.searchQuery);
  }
  setSearchMode(mode: 'scripture' | 'notes') {
    if (mode === this.searchMode) return;
    this.searchMode = mode;
    void this.runSearch(this.searchQuery);
  }
  goToHit(hit: SearchHit) {
    this.searchOpen = false;
    this.goTo(hit.bookId, hit.chapter);
  }
  goToNoteHit(hit: NoteHit) {
    this.searchOpen = false;
    this.goTo(hit.bookId, hit.chapter);
  }

  // --- Bookmarks -----------------------------------------------------------
  openBookmarks() {
    this.bookmarksOpen = true;
  }
  closeBookmarks() {
    this.bookmarksOpen = false;
  }
  /** Bookmark the current chapter, or remove the bookmark if it already exists. */
  toggleBookmark() {
    const existing = this.bookmarks.find((b) => b.bookId === this.bookId && b.chapter === this.chapter);
    if (existing) {
      this.removeBookmark(existing.id);
      return;
    }
    const bm: Bookmark = {
      id: crypto.randomUUID(),
      bookId: this.bookId,
      chapter: this.chapter,
      label: `${this.book?.name ?? ''} ${this.chapter}`.trim(),
      created: new Date().toISOString(),
    };
    this.bookmarks = [...this.bookmarks, bm].sort((a, b) => a.bookId - b.bookId || a.chapter - b.chapter);
    void this.provider?.addBookmark(bm);
  }
  removeBookmark(id: string) {
    this.bookmarks = this.bookmarks.filter((b) => b.id !== id);
    void this.provider?.deleteBookmark(id);
  }
  goToBookmark(bm: Bookmark) {
    this.bookmarksOpen = false;
    this.goTo(bm.bookId, bm.chapter);
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
      version: 3,
      exportedAt: new Date().toISOString(),
      layers: this.layers,
      marks: this.marks,
      notes: this.notes,
      readingProgress: [...this.companionProgress],
      bookmarks: this.bookmarks,
    };
    return JSON.stringify(data, null, 2);
  }

  async importJSON(raw: string) {
    const data = JSON.parse(raw) as MarkingsExport;
    if (data.version !== 2 && data.version !== 3) {
      throw new Error(`Unsupported export version: ${data.version}`);
    }
    if (Array.isArray(data.layers) && data.layers.length) this.layers = data.layers;
    this.marks = Array.isArray(data.marks) ? data.marks : [];
    this.notes = Array.isArray(data.notes) ? data.notes : [];
    await this.provider?.replaceUserData({
      layers: this.layers,
      marks: this.marks,
      notes: this.notes,
    });
    // v3 additions — restore only when present (older exports omit them).
    if (Array.isArray(data.readingProgress)) {
      this.companionProgress = new Set(data.readingProgress);
      await this.provider?.replaceReadingProgress(data.readingProgress);
    }
    if (Array.isArray(data.bookmarks)) {
      this.bookmarks = data.bookmarks;
      await this.provider?.replaceBookmarks(data.bookmarks);
    }
  }
}

export const app = new AppState();
