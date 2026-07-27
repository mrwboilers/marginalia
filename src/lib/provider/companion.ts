import type { CompanionPortion } from '../types';

// The Bible Companion schedule (Robert Roberts) is a single static JSON keyed
// "month-day" (e.g. "1-1"), bundled so it works offline — same pattern as xrefs.
// Built by data/build-companion.mjs. Loaded once and cached for the session.
let schedule: Record<string, CompanionPortion[]> = {};
let orderedKeys: string[] = [];
let loaded = false;

const byCalendar = (a: string, b: string) => {
  const [ma, da] = a.split('-').map(Number);
  const [mb, db] = b.split('-').map(Number);
  return ma - mb || da - db;
};

export async function loadCompanion(): Promise<void> {
  if (loaded) return;
  try {
    const res = await fetch('/companion.json');
    schedule = res.ok ? ((await res.json()) as Record<string, CompanionPortion[]>) : {};
  } catch {
    schedule = {};
  }
  orderedKeys = Object.keys(schedule).sort(byCalendar);
  loaded = true;
}

/** All schedule day-keys in calendar order (for prev/next browsing). */
export function companionKeys(): string[] {
  return orderedKeys;
}

/**
 * Resolve a month/day to a schedule key. The plan is a perpetual 365-day calendar,
 * so Feb 29 (which has no entry) falls back to the last dated day on or before it.
 */
export function keyFor(month: number, day: number): string {
  for (let d = day; d >= 1; d--) {
    if (schedule[`${month}-${d}`]) return `${month}-${d}`;
  }
  return `${month}-${day}`;
}

export function readingsFor(key: string): CompanionPortion[] {
  return schedule[key] ?? [];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Human date label for a schedule key, e.g. "1-1" -> "January 1". */
export function companionLabel(key: string): string {
  const [m, d] = key.split('-').map(Number);
  return `${MONTH_NAMES[m - 1] ?? '?'} ${d}`;
}
