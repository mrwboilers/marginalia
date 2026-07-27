// Rich-text helpers for margin notes. Notes are stored as sanitized HTML
// (format: 'html'); legacy notes are plain text. Everything here runs in the
// browser (the DOM is the parser/sanitizer) — notes only ever render client-side.

// Allowed tags and, per tag, their allowed attributes. Anything else is unwrapped
// (kept as text) or, for script/style, dropped entirely. This is the trust boundary
// for `{@html}`: content can arrive via import, so we never render unsanitized.
const ALLOWED: Record<string, string[]> = {
  P: [], BR: [], H3: [], H4: [],
  STRONG: [], B: [], EM: [], I: [], U: [], S: [], STRIKE: [],
  UL: [], OL: [], LI: [], BLOCKQUOTE: [], CODE: [], PRE: [],
  A: ['href'], IMG: ['src', 'alt'],
};
const DROP_CONTENT = new Set(['SCRIPT', 'STYLE', 'HEAD', 'TITLE', 'IFRAME', 'OBJECT', 'EMBED']);

// Control chars + whitespace (U+0000–U+0020), stripped from URLs so obfuscations
// like "java\tscript:" or newline-split schemes can't slip past the scheme test.
const URL_JUNK = /[\u0000-\u0020]/g;

function safeUrl(url: string, kind: 'link' | 'img'): string | null {
  const clean = url.replace(URL_JUNK, '');
  if (kind === 'img') {
    return /^data:image\/(png|jpe?g|gif|webp|avif);/i.test(clean) || /^https?:\/\//i.test(clean)
      ? clean
      : null;
  }
  return /^(https?:|mailto:)/i.test(clean) ? clean : null;
}

function sanitizeNode(node: Node, out: Node, doc: Document): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      out.appendChild(doc.createTextNode(child.nodeValue ?? ''));
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as Element;
    const tag = el.tagName;

    if (DROP_CONTENT.has(tag)) continue; // drop element and its subtree

    const allowedAttrs = ALLOWED[tag];
    if (!allowedAttrs) {
      // Unknown tag: unwrap — keep its (sanitized) children, discard the wrapper.
      sanitizeNode(el, out, doc);
      continue;
    }

    const clean = doc.createElement(tag);
    for (const attr of allowedAttrs) {
      const raw = el.getAttribute(attr);
      if (raw == null) continue;
      if (tag === 'A' && attr === 'href') {
        const safe = safeUrl(raw, 'link');
        if (safe) clean.setAttribute(attr, safe);
      } else if (tag === 'IMG' && attr === 'src') {
        const safe = safeUrl(raw, 'img');
        if (safe) clean.setAttribute(attr, safe);
      } else {
        clean.setAttribute(attr, raw);
      }
    }
    if (tag === 'IMG' && !clean.getAttribute('src')) continue; // no valid src → drop
    if (tag === 'A' && clean.getAttribute('href')) {
      clean.setAttribute('target', '_blank');
      clean.setAttribute('rel', 'noopener noreferrer');
    }
    sanitizeNode(el, clean, doc);
    out.appendChild(clean);
  }
}

/** Return a sanitized copy of `html`, safe to render via `{@html}`. */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const result = doc.createElement('div');
  sanitizeNode(doc.body, result, doc);
  return result.innerHTML;
}

/** Plain-text excerpt of a note (for the margin chip preview / emptiness checks). */
export function htmlToPlainText(html: string): string {
  // Insert a space between block-level elements so "…Christ</p><p>A voice…"
  // reads as two words, not one, in the collapsed chip preview.
  const spaced = html.replace(/<\/(p|h3|h4|li|blockquote|div|br)>/gi, '$& ').replace(/<br\s*\/?>/gi, ' ');
  const doc = new DOMParser().parseFromString(spaced, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** True when an HTML note has neither visible text nor an image. */
export function isHtmlEmpty(html: string): boolean {
  if (htmlToPlainText(html).length > 0) return false;
  return !/<img\b/i.test(html);
}

/** Convert a legacy plain-text note into HTML paragraphs (used when first editing it). */
export function textToHtml(text: string): string {
  if (!text.trim()) return '';
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${esc(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}
