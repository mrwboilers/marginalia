// Pure token helpers for the Strong's build, shared with the unit tests.
//
// A verse's Strong's data is a list of segments `{ t, s? }` where `t` is a text
// run and `s` are the Strong's numbers on that run's last word. Concatenating
// every `t` must reproduce the verse text exactly, or highlight/underline
// character offsets won't line up between normal and Strong's rendering.

/** Split a tagged "en" string (kaiserlik/kjv) into [{ t, s? }] segments. */
export function tokenize(en) {
  const clean = en.replace(/<\/?em>/g, '');
  const re = /([^[]*)((?:\[[HG]\d+\])+)/g;
  const segs = [];
  let last = 0;
  let m;
  while ((m = re.exec(clean))) {
    const tags = m[2].match(/[HG]\d+/g);
    segs.push(m[1] ? { t: m[1], s: tags } : { t: '', s: tags });
    last = re.lastIndex;
  }
  const tail = clean.slice(last);
  if (tail) segs.push({ t: tail });
  return segs.filter((seg) => seg.t.length > 0 || seg.s);
}

/** The plain verse text a segment list renders to. */
export function plainOf(segs) {
  return segs.map((s) => s.t).join('');
}

/**
 * Re-tile the segments' text over the authoritative `dbText` so that
 * `plainOf(reconcile(segs, dbText)) === dbText` exactly, while keeping each
 * Strong's number on the same character span.
 *
 * The kaiserlik source differs from the bundled KJV in two position-preserving
 * ways — a curly vs. straight apostrophe (same length) and trailing words the
 * source drops (e.g. "and it was so."). Slicing each segment's span out of the
 * DB text fixes the glyphs, and any remaining tail is appended untagged. The DB
 * text stays the single source of truth for what the reader sees.
 */
export function reconcile(segs, dbText) {
  let cursor = 0;
  const out = [];
  for (const seg of segs) {
    const len = seg.t.length;
    const t = dbText.slice(cursor, cursor + len);
    cursor += len;
    // A segment that falls entirely past the (shorter, authoritative) text is
    // dropped; an originally-empty tagged segment is kept so its number survives.
    if (len > 0 && t.length === 0) continue;
    out.push(seg.s ? { t, s: seg.s } : { t });
  }
  if (cursor < dbText.length) out.push({ t: dbText.slice(cursor) });
  return out;
}
