import type { Mark } from './types';

/** A rendered slice of verse text with its resolved styling. */
export interface RenderPiece {
  text: string;
  highlight?: string;
  underline?: boolean;
  markIds: string[];
}

/**
 * Split `text` — a slice of a verse starting at absolute character `baseOffset` —
 * into styled pieces given the `marks` that apply to the verse. Marks stay anchored
 * to whole-verse character offsets; `baseOffset` lets a Strong's segment (a partial
 * slice) be styled correctly. `marks` should already be filtered to the verse and
 * to visible layers; only their character ranges matter here.
 *
 * Where marks overlap, the last highlight wins (its color), underline is additive,
 * and every covering mark's id is recorded (so an erase click can target them).
 */
export function renderPieces(baseOffset: number, text: string, marks: Mark[]): RenderPiece[] {
  const len = text.length;
  const relevant = marks.filter((m) => m.end > baseOffset && m.start < baseOffset + len);
  if (!relevant.length) return [{ text, markIds: [] }];

  // Cut points: every mark boundary that falls inside this slice, plus the ends.
  const bounds = new Set<number>([0, len]);
  for (const m of relevant) {
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
    const covering = relevant.filter((m) => m.start <= abs && m.end >= absE);
    const highlight = covering.filter((m) => m.type === 'highlight').at(-1)?.color;
    const underline = covering.some((m) => m.type === 'underline');
    pieces.push({ text: text.slice(s, e), highlight, underline, markIds: covering.map((m) => m.id) });
  }
  return pieces;
}
