import type { BibleProvider } from '../provider';
import type { BookMeta, Note, SearchHit } from '../types';
import { matchNotes, type NoteHit } from '../notesearch';

interface SearchDeps {
  provider: () => BibleProvider | null;
  notes: () => Note[];
  books: () => BookMeta[];
  translationId: () => number;
  navigate: (bookId: number, chapter: number) => void;
}

/**
 * Search state — both scripture (provider FTS, scoped to the current translation)
 * and the user's own notes (in memory). Extracted from the god store; it reads the
 * notes/books/translation it needs through injected getters and navigates via a
 * callback, so it owns no other domain's state.
 */
export class SearchState {
  private deps: SearchDeps;

  open = $state(false);
  query = $state('');
  searching = $state(false);
  results = $state<SearchHit[]>([]);
  mode = $state<'scripture' | 'notes'>('scripture');
  noteResults = $state<NoteHit[]>([]);
  noteTagFilter = $state<string | null>(null);

  constructor(deps: SearchDeps) {
    this.deps = deps;
  }

  // A getter (not a field `$derived`) so it doesn't read injected `deps` before the
  // constructor assigns it; it stays reactive because the template tracks the
  // `notes()` read when it renders.
  get allNoteTags(): string[] {
    return [...new Set(this.deps.notes().flatMap((n) => n.tags ?? []))].sort();
  }

  openPanel() {
    this.open = true;
  }
  closePanel() {
    this.open = false;
  }

  async run(query: string) {
    this.query = query;
    if (this.mode === 'notes') {
      this.runNotes(query);
      return;
    }
    const provider = this.deps.provider();
    if (!query.trim() || !provider) {
      this.results = [];
      return;
    }
    this.searching = true;
    try {
      this.results = await provider.search(this.deps.translationId(), query, 200);
    } finally {
      this.searching = false;
    }
  }

  /** Search the user's own notes (in memory — no provider round-trip). */
  runNotes(query: string) {
    this.noteResults = matchNotes(
      this.deps.notes(),
      query,
      (id) => this.deps.books().find((b) => b.id === id)?.name ?? '',
      this.noteTagFilter
    );
  }

  setTagFilter(tag: string | null) {
    this.noteTagFilter = this.noteTagFilter === tag ? null : tag;
    this.runNotes(this.query);
  }
  setMode(mode: 'scripture' | 'notes') {
    if (mode === this.mode) return;
    this.mode = mode;
    void this.run(this.query);
  }
  goToHit(hit: SearchHit) {
    this.open = false;
    this.deps.navigate(hit.bookId, hit.chapter);
  }
  goToNoteHit(hit: NoteHit) {
    this.open = false;
    this.deps.navigate(hit.bookId, hit.chapter);
  }
}
