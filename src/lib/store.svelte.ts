import type {
  Bookmark, BookMeta, Layer, Mark, MarkingsExport, Note, StrongSeg, ToolMode, Translation, Verse, Xref,
} from './types';
import { HIGHLIGHT_COLORS, KJV_TRANSLATION_ID, LAYER_COLORS } from './types';
import { DEFAULT_LAYERS, getProvider, type BibleProvider } from './provider';
import { loadLexicon, loadStrongsChapter } from './provider/strongs';
import { parseReference } from './reference';
import { autoBackup, manualBackup, revealBackups } from './backup';
import { marksForVerse, normalizeImportedMarks, renderPieces, type RenderPiece } from './marks';
import { CompanionState } from './state/companion.svelte';
import { SearchState } from './state/search.svelte';
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
  translations = $state<Translation[]>([]);
  translationId = $state(KJV_TRANSLATION_ID);
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

  bookmarks = $state<Bookmark[]>([]);
  bookmarksOpen = $state(false);
  layersOpen = $state(false);
  lightboxSrc = $state<string | null>(null); // a note image opened full-size

  // Navigation history (Back/Forward) and a transient status toast.
  private navBack = $state<{ bookId: number; chapter: number }[]>([]);
  private navFwd = $state<{ bookId: number; chapter: number }[]>([]);
  toast = $state('');
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  // Domain sub-stores extracted from this god object (composed here; they reach
  // back into shared state only through injected getters + a navigate callback).
  companion = new CompanionState((bookId, chapter) => this.goTo(bookId, chapter));
  search = new SearchState({
    provider: () => this.provider,
    notes: () => this.notes,
    books: () => this.books,
    translationId: () => this.translationId,
    navigate: (bookId, chapter) => this.goTo(bookId, chapter),
  });

  private noteTimers = new Map<string, ReturnType<typeof setTimeout>>();

  book = $derived(this.books.find((b) => b.id === this.bookId));
  currentTranslation = $derived(this.translations.find((t) => t.id === this.translationId));
  /** Strong's is tied to the KJV wording, so it's only offered for translations that have it. */
  strongsAvailable = $derived(this.currentTranslation?.hasStrongs ?? false);

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

  async init() {
    this.provider = await getProvider();
    this.books = await this.provider.books();
    this.translations = await this.provider.translations();
    const data = await this.provider.loadUserData();

    this.layers = data.layers.length ? data.layers : structuredClone(DEFAULT_LAYERS);
    this.marks = data.marks;
    this.notes = data.notes;
    this.activeLayerId = this.layers[0].id;

    await this.companion.init(this.provider);

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
    const savedTranslation = Number(settings.translation);
    if (savedTranslation && this.translations.some((t) => t.id === savedTranslation)) {
      this.translationId = savedTranslation;
    }

    await this.loadChapter(this.bookId, this.chapter);
    this.ready = true;

    // Safety net: on each launch, snapshot the data to the managed backups folder
    // (native only; keeps the newest 20). Skipped when there's nothing to protect.
    if (this.marks.length || this.notes.length || this.bookmarks.length) {
      void autoBackup(this.exportJSON());
    }
  }

  /** Explicit backup (toolbar). Native → backups folder; browser → download. */
  backupNow(): Promise<'saved' | 'downloaded'> {
    return manualBackup(this.exportJSON());
  }
  showBackups() {
    void revealBackups();
  }

  private async loadChapter(bookId: number, chapter: number) {
    if (!this.provider) return;
    this.loadingChapter = true;
    try {
      const [verses, xrefs] = await Promise.all([
        this.provider.chapter(this.translationId, bookId, chapter),
        this.provider.xrefs(bookId, chapter),
      ]);
      this.verses = verses;
      this.xrefs = xrefs;
      this.bookId = bookId;
      this.chapter = chapter;
      this.strongsByVerse =
        this.strongsOn && this.strongsAvailable ? await loadStrongsChapter(bookId, chapter) : new Map();
      // Remember where we are so the app reopens here next time. One key (not two)
      // so the read-modify-write can't race and drop half the position.
      void this.provider.saveSetting('lastRef', `${bookId}:${chapter}`);
    } finally {
      this.loadingChapter = false;
    }
  }

  /** Navigate to a chapter. Records the current spot for Back unless `history` is false. */
  goTo(bookId: number, chapter: number, history = true) {
    if (history && (bookId !== this.bookId || chapter !== this.chapter)) {
      this.navBack = [...this.navBack, { bookId: this.bookId, chapter: this.chapter }];
      this.navFwd = [];
    }
    void this.loadChapter(bookId, chapter);
  }

  canBack = $derived(this.navBack.length > 0);
  canForward = $derived(this.navFwd.length > 0);
  back() {
    const prev = this.navBack.at(-1);
    if (!prev) return;
    this.navBack = this.navBack.slice(0, -1);
    this.navFwd = [...this.navFwd, { bookId: this.bookId, chapter: this.chapter }];
    void this.loadChapter(prev.bookId, prev.chapter);
  }
  forward() {
    const next = this.navFwd.at(-1);
    if (!next) return;
    this.navFwd = this.navFwd.slice(0, -1);
    this.navBack = [...this.navBack, { bookId: this.bookId, chapter: this.chapter }];
    void this.loadChapter(next.bookId, next.chapter);
  }

  /** Navigate to a free-typed reference ("Jn 3:16"). Returns false if unrecognized. */
  jumpToReference(input: string): boolean {
    const t = parseReference(input);
    if (!t) return false;
    this.goTo(t.bookId, t.chapter);
    return true;
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

  /** Switch the reading translation: persist, reload the chapter, drop Strong's if N/A. */
  async setTranslation(id: number) {
    if (id === this.translationId || !this.translations.some((t) => t.id === id)) return;
    this.translationId = id;
    void this.provider?.saveSetting('translation', String(id));
    if (!this.strongsAvailable) this.strongsOn = false;
    await this.loadChapter(this.bookId, this.chapter);
  }

  async toggleStrongs() {
    if (!this.strongsAvailable) return; // Strong's is KJV-only
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

  openImage(src: string) {
    this.lightboxSrc = src;
  }
  closeImage() {
    this.lightboxSrc = null;
  }

  showToast(msg: string) {
    this.toast = msg;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = ''), 1600);
  }

  /** Copy a verse's text with its reference to the clipboard. */
  async copyVerse(v: number) {
    const verse = this.verses.find((x) => x.v === v);
    if (!verse) return;
    const ref = `${this.book?.name ?? ''} ${this.chapter}:${v}`.trim();
    const text = `“${verse.text}” — ${ref}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for webviews where the async clipboard API is unavailable.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
    }
    this.showToast(`Copied ${ref}`);
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
      translationId: this.translationId,
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
    return marksForVerse(this.marks, {
      translationId: this.translationId,
      bookId: this.bookId,
      chapter: this.chapter,
      verse: v,
      isLayerVisible: (id) => this.visibleLayerIds.has(id),
    });
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

  // --- Cross-reference lookup (hover preview + click to navigate) ----------
  private refChapterCache = new Map<string, Verse[]>();

  private async chapterFor(bookId: number, chapter: number): Promise<Verse[]> {
    const key = `${this.translationId}:${bookId}:${chapter}`; // preview text is per-translation
    let verses = this.refChapterCache.get(key);
    if (!verses && this.provider) {
      verses = await this.provider.chapter(this.translationId, bookId, chapter);
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
      version: 4,
      exportedAt: new Date().toISOString(),
      layers: this.layers,
      marks: this.marks,
      notes: this.notes,
      readingProgress: this.companion.progressList(),
      bookmarks: this.bookmarks,
    };
    return JSON.stringify(data, null, 2);
  }

  async importJSON(raw: string) {
    const data = JSON.parse(raw) as MarkingsExport;
    if (data.version !== 2 && data.version !== 3 && data.version !== 4) {
      throw new Error(`Unsupported export version: ${data.version}`);
    }
    if (Array.isArray(data.layers) && data.layers.length) this.layers = data.layers;
    // Pre-v4 exports lack mark translationId — backfill to KJV so they still render.
    this.marks = normalizeImportedMarks(Array.isArray(data.marks) ? data.marks : []);
    this.notes = Array.isArray(data.notes) ? data.notes : [];
    await this.provider?.replaceUserData({
      layers: this.layers,
      marks: this.marks,
      notes: this.notes,
    });
    // v3+ additions — restore only when present (older exports omit them).
    if (Array.isArray(data.readingProgress)) {
      await this.companion.replaceProgress(data.readingProgress);
    }
    if (Array.isArray(data.bookmarks)) {
      this.bookmarks = data.bookmarks;
      await this.provider?.replaceBookmarks(data.bookmarks);
    }
  }
}

export const app = new AppState();
