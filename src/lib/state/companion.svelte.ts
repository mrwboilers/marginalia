import type { BibleProvider } from '../provider';
import type { CompanionPortion } from '../types';
import { companionKeys, companionLabel, keyFor, loadCompanion, readingsFor } from '../provider/companion';

/**
 * Bible Companion (Robert Roberts' reading plan) state — extracted from the god
 * store into its own domain module. It reaches out only via an injected `navigate`
 * (to open a reading) and the provider (to persist per-portion progress).
 */
export class CompanionState {
  private provider: BibleProvider | null = null;
  private navigate: (bookId: number, chapter: number) => void;

  open = $state(false);
  key = $state('1-1'); // the day being viewed ("month-day")
  todayKey = $state('1-1'); // the real current calendar day
  progress = $state<Set<string>>(new Set()); // "done" portion keys

  readings = $derived(readingsFor(this.key));
  dateLabel = $derived(companionLabel(this.key));
  isToday = $derived(this.key === this.todayKey);
  dayDone = $derived(
    this.readings.length > 0 &&
      this.readings.every((_, i) => this.progress.has(`${this.key}:${i}`))
  );

  constructor(navigate: (bookId: number, chapter: number) => void) {
    this.navigate = navigate;
  }

  async init(provider: BibleProvider) {
    this.provider = provider;
    await loadCompanion();
    const now = new Date();
    this.todayKey = keyFor(now.getMonth() + 1, now.getDate());
    this.key = this.todayKey;
    this.progress = new Set(await provider.loadReadingProgress());
  }

  openPanel() {
    this.key = this.todayKey; // always land on today
    this.open = true;
  }
  closePanel() {
    this.open = false;
  }
  goToday() {
    this.key = this.todayKey;
  }
  /** Step to the previous/next scheduled day, wrapping around the year. */
  step(delta: number) {
    const keys = companionKeys();
    const i = keys.indexOf(this.key);
    if (i < 0) return;
    this.key = keys[(i + delta + keys.length) % keys.length];
  }
  isReadingDone(index: number): boolean {
    return this.progress.has(`${this.key}:${index}`);
  }
  toggleReadingDone(index: number) {
    const key = `${this.key}:${index}`;
    const done = !this.progress.has(key);
    const next = new Set(this.progress);
    if (done) next.add(key);
    else next.delete(key);
    this.progress = next;
    void this.provider?.setReadingDone(key, done);
  }
  toggleDayDone() {
    const target = !this.dayDone;
    this.readings.forEach((_, i) => {
      if (this.isReadingDone(i) !== target) this.toggleReadingDone(i);
    });
  }
  openReading(portion: CompanionPortion) {
    this.open = false;
    this.navigate(portion.bookId, portion.start);
  }

  // --- Export / import ---
  progressList(): string[] {
    return [...this.progress];
  }
  async replaceProgress(keys: string[]) {
    this.progress = new Set(keys);
    await this.provider?.replaceReadingProgress(keys);
  }
}
