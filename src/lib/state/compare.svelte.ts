import type { BibleProvider } from '../provider';
import type { Translation, Verse } from '../types';
import { orderSelected } from './compare-order';

interface CompareDeps {
  provider: () => BibleProvider | null;
  translations: () => Translation[];
  currentTranslationId: () => number;
  bookName: (bookId: number) => string;
  /** The chapter `delta` steps away (crossing books), or null at the ends. */
  neighbor: (bookId: number, chapter: number, delta: number) => { bookId: number; chapter: number } | null;
}

/** One translation's text for the compared chapter. */
export interface CompareColumn {
  translation: Translation;
  verses: Verse[];
}

/**
 * Side-by-side translation comparison for a single chapter. Each selected
 * translation becomes a column; the view aligns them by verse number (so a verse
 * missing from one translation just leaves a gap) and scrolls as one. Extracted
 * from the god store like Search/Companion — it reaches shared state only through
 * injected getters.
 */
export class CompareState {
  private deps: CompareDeps;

  open = $state(false);
  bookId = $state(1);
  chapter = $state(1);
  /** Verse to scroll into view when the panel opens (the reading anchor). */
  focusVerse = $state<number | null>(null);
  /** Translation ids shown, left-to-right (the current translation stays first). */
  selectedIds = $state<number[]>([]);
  columns = $state<CompareColumn[]>([]);
  loading = $state(false);
  /** Monotonic id so a slow reload can't overwrite a newer one's results. */
  private loadSeq = 0;

  constructor(deps: CompareDeps) {
    this.deps = deps;
  }

  get available(): Translation[] {
    return this.deps.translations();
  }
  get label(): string {
    return `${this.deps.bookName(this.bookId)} ${this.chapter}`;
  }
  get canPrev(): boolean {
    return this.deps.neighbor(this.bookId, this.chapter, -1) !== null;
  }
  get canNext(): boolean {
    return this.deps.neighbor(this.bookId, this.chapter, 1) !== null;
  }
  isSelected(id: number): boolean {
    return this.selectedIds.includes(id);
  }

  /** Open the comparison at a passage, defaulting to every translation selected. */
  async openAt(bookId: number, chapter: number, focusVerse: number | null = null) {
    this.bookId = bookId;
    this.chapter = chapter;
    this.focusVerse = focusVerse;
    const canonical = this.deps.translations().map((t) => t.id);
    const current = this.deps.currentTranslationId();
    // First open compares every translation; later opens keep the prior selection
    // but always ensure the current reading translation is present and leads.
    const base = this.selectedIds.length ? this.selectedIds : canonical;
    const ids = base.includes(current) ? base : [...base, current];
    this.selectedIds = orderSelected(ids, current, canonical);
    this.open = true;
    await this.reload();
  }

  closePanel() {
    this.open = false;
  }

  async toggleTranslation(id: number) {
    let ids: number[];
    if (this.selectedIds.includes(id)) {
      if (this.selectedIds.length <= 1) return; // keep at least one column
      ids = this.selectedIds.filter((x) => x !== id);
    } else {
      ids = [...this.selectedIds, id];
    }
    // Keep the current reading translation first, the rest in canonical order.
    this.selectedIds = orderSelected(ids, this.deps.currentTranslationId(), this.deps.translations().map((t) => t.id));
    await this.reload();
  }

  async step(delta: number) {
    const next = this.deps.neighbor(this.bookId, this.chapter, delta);
    if (!next) return;
    this.bookId = next.bookId;
    this.chapter = next.chapter;
    this.focusVerse = null;
    await this.reload();
  }

  private async reload() {
    const provider = this.deps.provider();
    if (!provider) return;
    const seq = ++this.loadSeq;
    this.loading = true;
    try {
      const byId = new Map(this.deps.translations().map((t) => [t.id, t]));
      const cols = await Promise.all(
        this.selectedIds.map(async (id) => {
          const translation = byId.get(id);
          if (!translation) return null;
          const verses = await provider.chapter(id, this.bookId, this.chapter);
          return { translation, verses };
        })
      );
      // Drop results if a newer reload has started while we were awaiting.
      if (seq !== this.loadSeq) return;
      this.columns = cols.filter((c): c is CompareColumn => c !== null);
    } finally {
      if (seq === this.loadSeq) this.loading = false;
    }
  }
}
