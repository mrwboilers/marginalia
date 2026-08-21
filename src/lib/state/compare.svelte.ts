import type { BibleProvider } from '../provider';
import type { Translation, Verse } from '../types';

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
    const current = this.deps.currentTranslationId();
    if (this.selectedIds.length === 0) {
      // Current translation first, then the rest, so the reader's version leads.
      const others = this.deps.translations().map((t) => t.id).filter((id) => id !== current);
      this.selectedIds = [current, ...others];
    } else if (!this.selectedIds.includes(current)) {
      this.selectedIds = [current, ...this.selectedIds];
    }
    this.open = true;
    await this.reload();
  }

  closePanel() {
    this.open = false;
  }

  async toggleTranslation(id: number) {
    if (this.selectedIds.includes(id)) {
      if (this.selectedIds.length <= 1) return; // keep at least one column
      this.selectedIds = this.selectedIds.filter((x) => x !== id);
    } else {
      // Preserve canonical translation order when re-adding.
      const order = this.deps.translations().map((t) => t.id);
      this.selectedIds = [...this.selectedIds, id].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    }
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
      this.columns = cols.filter((c): c is CompareColumn => c !== null);
    } finally {
      this.loading = false;
    }
  }
}
