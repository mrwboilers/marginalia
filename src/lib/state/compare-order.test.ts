import { describe, it, expect } from 'vitest';
import { orderSelected } from './compare-order';

// Canonical registry order: KJV=1, WEB=2, BSB=3, YLT=4.
const CANON = [1, 2, 3, 4];

describe('orderSelected', () => {
  it('puts the current translation first, the rest in canonical order', () => {
    expect(orderSelected([1, 2, 3, 4], 3, CANON)).toEqual([3, 1, 2, 4]);
  });

  it('sorts the remainder canonically regardless of input order', () => {
    expect(orderSelected([4, 2, 1, 3], 1, CANON)).toEqual([1, 2, 3, 4]);
    expect(orderSelected([4, 2, 3], 2, CANON)).toEqual([2, 3, 4]);
  });

  it('omits the current translation when it is not selected', () => {
    // e.g. the reader deselected their own translation.
    expect(orderSelected([1, 3, 4], 2, CANON)).toEqual([1, 3, 4]);
  });

  it('is a no-op shape for a single selected translation', () => {
    expect(orderSelected([2], 2, CANON)).toEqual([2]);
    expect(orderSelected([2], 1, CANON)).toEqual([2]);
  });

  // Reported case 1: opened with KJV leading, reader switches to BSB and reopens.
  it('re-leads with the new current translation on reopen', () => {
    const afterFirstOpen = orderSelected([1, 2, 3, 4], 1, CANON); // current KJV
    expect(afterFirstOpen).toEqual([1, 2, 3, 4]);
    // Reader is now BSB; reopen keeps the same selection but BSB must lead.
    expect(orderSelected(afterFirstOpen, 3, CANON)).toEqual([3, 1, 2, 4]);
  });

  // Reported case 2: re-adding a translation must not move current off column 1.
  it('keeps the current translation first when another is toggled back on', () => {
    // Current is BSB, leading; YLT was toggled off then on again.
    const readded = orderSelected([3, 1, 2, 4], 3, CANON);
    expect(readded[0]).toBe(3);
    expect(readded).toEqual([3, 1, 2, 4]);
  });
});
