<script lang="ts">
  import { onMount } from 'svelte';
  import { sanitizeHtml } from '../richtext';
  import { imageToDataUrl } from '../image';

  let { html = '', onchange }: { html?: string; onchange: (html: string) => void } = $props();

  let editable: HTMLDivElement | undefined = $state();
  let fileInput: HTMLInputElement | undefined = $state();
  let linking = $state(false);
  let linkUrl = $state('');
  let savedRange: Range | null = null;

  onMount(() => {
    if (!editable) return;
    // Enter should create <p> blocks (not <div>), and every edit should sit inside a
    // block — bare text nodes make formatBlock/list commands reorder content.
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch {
      /* not supported everywhere; harmless */
    }
    editable.innerHTML = html || '<p><br></p>'; // set once; never re-assigned (would jump the caret)
    // preventScroll: a just-created note mounts at top:0 before its margin position
    // is measured, so a scrolling focus would yank the reading view to the top.
    editable.focus({ preventScroll: true });
    moveCaretToEnd(editable);
  });

  function moveCaretToEnd(el: HTMLElement) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  /** Persist the sanitized value; the live editable DOM is left untouched. */
  function emit() {
    if (editable) onchange(sanitizeHtml(editable.innerHTML));
  }

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && editable?.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }
  }
  function restoreSelection() {
    if (!savedRange || !editable) return;
    editable.focus();
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(savedRange);
  }

  function exec(command: string, value?: string) {
    editable?.focus();
    document.execCommand(command, false, value);
    emit();
  }

  // --- Images ---------------------------------------------------------------
  async function insertImageFile(file: File) {
    try {
      const url = await imageToDataUrl(file);
      restoreSelection();
      document.execCommand('insertImage', false, url);
      emit();
    } catch (err) {
      console.error('Could not insert image:', err);
    }
  }
  async function onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) await insertImageFile(file);
  }

  async function onPaste(e: ClipboardEvent) {
    const dt = e.clipboardData;
    if (!dt) return;
    const imageItem = Array.from(dt.items).find(
      (it) => it.kind === 'file' && it.type.startsWith('image/')
    );
    if (imageItem) {
      e.preventDefault();
      saveSelection();
      const file = imageItem.getAsFile();
      if (file) await insertImageFile(file);
      return;
    }
    // Sanitize pasted rich text so the live DOM stays as clean as the stored value.
    const pastedHtml = dt.getData('text/html');
    if (pastedHtml) {
      e.preventDefault();
      document.execCommand('insertHTML', false, sanitizeHtml(pastedHtml));
      emit();
    }
  }

  async function onDrop(e: DragEvent) {
    const file = Array.from(e.dataTransfer?.files ?? []).find((f) => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    saveSelection();
    await insertImageFile(file);
  }

  // --- Links ----------------------------------------------------------------
  function openLink() {
    saveSelection();
    linkUrl = '';
    linking = true;
  }
  function applyLink() {
    const url = linkUrl.trim();
    linking = false;
    if (!url) return;
    restoreSelection();
    const sel = window.getSelection();
    if (sel && sel.isCollapsed) {
      // No selection: insert the URL itself as the link text.
      document.execCommand('insertHTML', false, `<a href="${url}">${url}</a>`);
    } else {
      document.execCommand('createLink', false, url);
    }
    emit();
  }

  type Btn = { label: string; title: string; run: () => void; cls?: string };
  const buttons: Btn[] = [
    { label: 'B', title: 'Bold', run: () => exec('bold'), cls: 'b' },
    { label: 'I', title: 'Italic', run: () => exec('italic'), cls: 'i' },
    { label: 'U', title: 'Underline', run: () => exec('underline'), cls: 'u' },
    { label: 'S', title: 'Strikethrough', run: () => exec('strikeThrough'), cls: 's' },
    { label: 'H', title: 'Heading', run: () => exec('formatBlock', '<h3>') },
    { label: '“ ”', title: 'Quote', run: () => exec('formatBlock', '<blockquote>') },
    { label: '•', title: 'Bulleted list', run: () => exec('insertUnorderedList') },
    { label: '1.', title: 'Numbered list', run: () => exec('insertOrderedList') },
    { label: '🔗', title: 'Link', run: openLink },
  ];
</script>

<div class="rte">
  <div class="toolbar" role="toolbar" aria-label="Formatting">
    {#each buttons as b (b.title)}
      <button
        type="button"
        class={`tb ${b.cls ?? ''}`}
        title={b.title}
        aria-label={b.title}
        onmousedown={(e) => e.preventDefault()}
        onclick={b.run}
      >{b.label}</button>
    {/each}
    <button
      type="button"
      class="tb"
      title="Insert image"
      aria-label="Insert image"
      onmousedown={(e) => { e.preventDefault(); saveSelection(); }}
      onclick={() => fileInput?.click()}
    >🖼</button>
    <input
      bind:this={fileInput}
      type="file"
      accept="image/*"
      class="file"
      onchange={onFileChange}
    />
  </div>

  {#if linking}
    <div class="linkbar">
      <input
        class="linkinput"
        placeholder="https://…"
        bind:value={linkUrl}
        onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } else if (e.key === 'Escape') linking = false; }}
      />
      <button type="button" class="tb" onclick={applyLink}>Add</button>
    </div>
  {/if}

  <div
    bind:this={editable}
    class="editable"
    contenteditable="true"
    role="textbox"
    aria-multiline="true"
    tabindex="0"
    oninput={emit}
    onpaste={onPaste}
    ondragover={(e) => e.preventDefault()}
    ondrop={onDrop}
  ></div>
</div>

<style>
  .rte {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.15rem;
  }
  .tb {
    min-width: 1.7rem;
    height: 1.7rem;
    padding: 0 0.35rem;
    border: 1px solid #e0d6c0;
    border-radius: 5px;
    background: #fffefb;
    color: #2b2520;
    font-size: 0.82rem;
    line-height: 1;
    cursor: pointer;
  }
  .tb:hover {
    border-color: #a4906f;
    background: #f4efe2;
  }
  .tb.b { font-weight: 700; }
  .tb.i { font-style: italic; }
  .tb.u { text-decoration: underline; }
  .tb.s { text-decoration: line-through; }
  .file {
    display: none;
  }
  .linkbar {
    display: flex;
    gap: 0.3rem;
  }
  .linkinput {
    flex: 1;
    font: inherit;
    font-size: 0.82rem;
    padding: 0.25rem 0.4rem;
    border: 1px solid #d8ccb4;
    border-radius: 5px;
    background: #fffefb;
    color: #2b2520;
  }
  .editable {
    min-height: 6rem;
    max-height: 50vh;
    overflow-y: auto;
    border: 1px solid #e0d6c0;
    border-radius: 6px;
    padding: 0.5rem 0.55rem;
    font-size: 0.9rem;
    line-height: 1.5;
    color: #2b2520;
    background: #fffefb;
  }
  .editable:focus {
    outline: 2px solid #c9b892;
    border-color: transparent;
  }
  /* Rich content styling inside the editor. */
  .editable :global(h3) {
    font-size: 1rem;
    margin: 0.3rem 0 0.2rem;
  }
  .editable :global(blockquote) {
    margin: 0.3rem 0;
    padding-left: 0.6rem;
    border-left: 3px solid #d8ccb4;
    color: #5f5344;
  }
  .editable :global(ul),
  .editable :global(ol) {
    margin: 0.2rem 0;
    padding-left: 1.3rem;
  }
  .editable :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    margin: 0.2rem 0;
  }
  .editable :global(a) {
    color: #7a5230;
  }
</style>
