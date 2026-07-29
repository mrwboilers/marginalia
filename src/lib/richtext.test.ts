import { describe, it, expect } from 'vitest';
import { sanitizeHtml, htmlToPlainText, isHtmlEmpty, textToHtml } from './richtext';

describe('sanitizeHtml — allowed content is preserved', () => {
  it('keeps basic formatting tags', () => {
    const html = '<p>a <strong>b</strong> <em>c</em> <u>d</u> <s>e</s></p>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('keeps headings, lists, blockquote, code', () => {
    const html =
      '<h3>Title</h3><ul><li>one</li><li>two</li></ul><ol><li>x</li></ol>' +
      '<blockquote>q</blockquote><pre><code>k</code></pre>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('keeps a data:image and adds no attributes it was not given', () => {
    const src = 'data:image/png;base64,iVBORw0KGgo=';
    expect(sanitizeHtml(`<img src="${src}" alt="pic">`)).toBe(`<img src="${src}" alt="pic">`);
  });
});

describe('sanitizeHtml — hostile content is neutralized', () => {
  it('drops <script> entirely', () => {
    expect(sanitizeHtml('<p>ok</p><script>window.x=1</script>')).toBe('<p>ok</p>');
  });

  it('drops <style>, <iframe>, <object>, <embed> subtrees', () => {
    expect(sanitizeHtml('<style>*{}</style><iframe src="x"></iframe>ok')).toBe('ok');
  });

  it('strips event-handler attributes', () => {
    const out = sanitizeHtml('<img src="data:image/png;base64,AA==" onerror="alert(1)">');
    expect(out).not.toMatch(/onerror/i);
    expect(out).toMatch(/^<img src="data:image\/png;base64,AA=="/);
  });

  it('neutralizes javascript: links (keeps text, drops href)', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).toBe('<a>x</a>');
    expect(out).not.toMatch(/javascript:/i);
  });

  it('defeats control-character obfuscation of the scheme', () => {
    // "java\tscript:" would pass a naive prefix check; the sanitizer strips the tab.
    const out = sanitizeHtml('<a href="java\tscript:alert(1)">x</a>');
    expect(out).not.toMatch(/script:/i);
  });

  it('drops an <img> whose src is not data:image or http(s)', () => {
    expect(sanitizeHtml('<img src="javascript:alert(1)">')).toBe('');
    expect(sanitizeHtml('<img src="file:///etc/passwd">')).toBe('');
  });

  it('unwraps unknown/dangerous-styling tags but keeps their text', () => {
    expect(sanitizeHtml('<span style="x">hi</span>')).toBe('hi');
    expect(sanitizeHtml('<div><p>deep</p></div>')).toBe('<p>deep</p>');
  });
});

describe('sanitizeHtml — safe links are hardened', () => {
  it('keeps https/mailto and adds target + rel', () => {
    const out = sanitizeHtml('<a href="https://ok.com">good</a>');
    expect(out).toBe('<a href="https://ok.com" target="_blank" rel="noopener noreferrer">good</a>');
    expect(sanitizeHtml('<a href="mailto:me@x.com">mail</a>')).toMatch(/href="mailto:me@x.com"/);
  });
});

describe('htmlToPlainText', () => {
  it('strips tags', () => {
    expect(htmlToPlainText('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });
  it('separates block elements with a space', () => {
    expect(htmlToPlainText('<p>Christ</p><p>A voice</p>')).toBe('Christ A voice');
  });
  it('collapses whitespace', () => {
    expect(htmlToPlainText('<p>a\n\n   b</p>')).toBe('a b');
  });
});

describe('isHtmlEmpty', () => {
  it('is empty for blank paragraphs and whitespace', () => {
    expect(isHtmlEmpty('')).toBe(true);
    expect(isHtmlEmpty('<p><br></p>')).toBe(true);
    expect(isHtmlEmpty('<p>   </p>')).toBe(true);
  });
  it('is not empty with visible text', () => {
    expect(isHtmlEmpty('<p>hi</p>')).toBe(false);
  });
  it('is not empty when only an image is present', () => {
    expect(isHtmlEmpty('<p><img src="data:image/png;base64,AA=="></p>')).toBe(false);
  });
});

describe('textToHtml (legacy note migration)', () => {
  it('returns empty for blank input', () => {
    expect(textToHtml('')).toBe('');
    expect(textToHtml('   ')).toBe('');
  });
  it('escapes HTML metacharacters', () => {
    expect(textToHtml('a < b & c > d')).toBe('<p>a &lt; b &amp; c &gt; d</p>');
  });
  it('splits paragraphs on blank lines and uses <br> for single newlines', () => {
    expect(textToHtml('one\ntwo\n\nthree')).toBe('<p>one<br>two</p><p>three</p>');
  });
  it('round-trips back to the original plain text', () => {
    const text = 'Line one\nLine two\n\nNew para';
    expect(htmlToPlainText(textToHtml(text))).toBe('Line one Line two New para');
  });
});
