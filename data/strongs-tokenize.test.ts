import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain .mjs build helper, no types
import { tokenize, plainOf, reconcile } from './strongs-tokenize.mjs';

describe('tokenize', () => {
  it('attaches Strong’s numbers to the preceding text run', () => {
    const segs = tokenize('In the beginning[H7225] God[H430] created[H1254]');
    expect(plainOf(segs)).toBe('In the beginning God created');
    expect(segs.find((s: any) => s.s?.includes('H7225'))?.t).toContain('beginning');
  });

  it('strips <em> translator-italic tags', () => {
    expect(plainOf(tokenize('there <em>was</em> light[H216]'))).toBe('there was light');
  });

  it('keeps a trailing untagged run', () => {
    expect(plainOf(tokenize('and God[H430] saw'))).toBe('and God saw');
  });
});

describe('reconcile — plainOf always equals the authoritative text', () => {
  it('appends a tail the source dropped', () => {
    // Strong's source stops at "appear:"; DB has the full verse.
    const segs = tokenize('let the dry land appear[H7200]:');
    const db = 'let the dry land appear: and it was so.';
    const fixed = reconcile(segs, db);
    expect(plainOf(fixed)).toBe(db);
    // The appended tail carries no Strong's number.
    expect(fixed.at(-1)).toEqual({ t: ' and it was so.' });
  });

  it('adopts the DB apostrophe glyph without shifting numbers', () => {
    const segs = tokenize("his wife's[H802] name"); // straight apostrophe in source
    const db = 'his wife’s name'; // curly in DB (same length)
    const fixed = reconcile(segs, db);
    expect(plainOf(fixed)).toBe(db);
    expect(fixed.find((s: any) => s.s?.includes('H802'))?.t).toBe('his wife’s');
  });

  it('is a no-op when the token text already matches', () => {
    const segs = tokenize('and God[H430] saw the light[H216]');
    const db = 'and God saw the light';
    expect(plainOf(reconcile(segs, db))).toBe(db);
  });

  it('clamps segments that run past a shorter authoritative text', () => {
    const segs = tokenize('extra words here[H1]');
    const db = 'extra words';
    const fixed = reconcile(segs, db);
    expect(plainOf(fixed)).toBe(db);
  });

  it('preserves an originally-empty tagged segment', () => {
    // A leading tag group with no text before it must keep its number.
    const segs = tokenize('[H430]God said');
    const db = 'God said';
    const fixed = reconcile(segs, db);
    expect(plainOf(fixed)).toBe(db);
    expect(fixed.some((s: any) => s.s?.includes('H430'))).toBe(true);
  });
});
