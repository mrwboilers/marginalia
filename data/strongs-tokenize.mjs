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

/** Lowercased alphanumerics only — matches words across punctuation/glyph diffs. */
function norm(w) {
  return w.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Re-tile the tagged segments over the authoritative `dbText`, hanging each
 * Strong's number on the correct DB *word*, so that `plainOf(reconcile(...))`
 * equals `dbText` exactly (keeping highlight/underline offsets valid) and every
 * number lands right after its word.
 *
 * Alignment is by word (an LCS over normalized word text), NOT by raw character
 * offset. The kaiserlik source diverges from the bundled KJV in several ways —
 * curly vs. straight apostrophes, punctuation, trailing words it drops, and the
 * occasional stray editorial glyph (e.g. a "➔"). A character-offset walk drifts
 * on any length change and shoves later numbers into the middle of words; a word
 * alignment simply doesn't match the odd token and drops it. The DB text stays
 * the single source of truth for what the reader sees.
 */
export function reconcile(segs, dbText) {
  // 1. Kaiserlik words in order, each with the Strong's numbers attached to it.
  //    A seg's numbers belong to the last word of its text run; a leading tag
  //    with no preceding word attaches to the following word.
  const kw = [];
  let buf = '';
  let leading = [];
  const flush = (numbers) => {
    if (buf) {
      kw.push({ w: buf, s: leading.concat(numbers || []) });
      buf = '';
      leading = [];
    } else if (numbers && numbers.length) {
      if (kw.length) kw[kw.length - 1].s.push(...numbers);
      else leading.push(...numbers);
    }
  };
  for (const seg of segs) {
    for (const ch of seg.t) {
      if (/\s/.test(ch)) flush(null); // whitespace completes the current word
      else buf += ch;
    }
    if (seg.s && seg.s.length) flush(seg.s); // tag follows a completed word
  }
  flush(null);

  // 2. DB words with their exact character spans.
  const dbWords = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(dbText))) {
    dbWords.push({ end: m.index + m[0].length, n: norm(m[0]), s: [] });
  }

  // 3. LCS-align kaiserlik words to DB words (by normalized text) and hang each
  //    matched word's numbers on its DB word.
  const a = kw.map((k) => k.w).map(norm);
  const b = dbWords.map((d) => d.n);
  const A = a.length;
  const B = b.length;
  const dp = Array.from({ length: A + 1 }, () => new Int32Array(B + 1));
  for (let i = A - 1; i >= 0; i--) {
    for (let j = B - 1; j >= 0; j--) {
      dp[i][j] = a[i] && a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < A && j < B) {
    if (a[i] && a[i] === b[j]) {
      if (kw[i].s.length) dbWords[j].s.push(...kw[i].s);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  // 4. Rebuild segments over dbText, cutting after each numbered DB word.
  const out = [];
  let cut = 0;
  for (const d of dbWords) {
    if (d.s.length) {
      out.push({ t: dbText.slice(cut, d.end), s: d.s });
      cut = d.end;
    }
  }
  if (cut < dbText.length) out.push({ t: dbText.slice(cut) });
  return out;
}
