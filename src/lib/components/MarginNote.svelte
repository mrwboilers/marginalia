<script lang="ts">
  import { app } from '../store.svelte';
  import type { Note } from '../types';
  import { htmlToPlainText, isHtmlEmpty, sanitizeHtml, textToHtml } from '../richtext';
  import RichNoteEditor from './RichNoteEditor.svelte';

  let {
    note,
    top,
    open = false,
    side = 'right',
  }: { note: Note; top: number; open?: boolean; side?: 'left' | 'right' } = $props();

  let editing = $state(false);
  let hovered = $state(false);

  const layerColor = $derived(app.layers.find((l) => l.id === note.layerId)?.color ?? '#8a7c66');
  const isHtml = $derived(note.format === 'html');
  const hasBody = $derived(isHtml ? !isHtmlEmpty(note.body) : note.body.trim().length > 0);
  const previewText = $derived(isHtml ? htmlToPlainText(note.body) : note.body);
  const hasImage = $derived(isHtml && /<img\b/i.test(note.body));

  // Auto-open the editor when the note is freshly created via the Note tool.
  $effect(() => {
    if (open) editing = true;
  });

  function close() {
    editing = false;
    // Don't leave an empty chip behind if the note was never written.
    if (!hasBody) app.deleteNote(note.id);
  }
</script>

<div
  class="mnote {side}"
  style={`top:${top}px`}
  role="note"
  onmouseenter={() => (hovered = true)}
  onmouseleave={() => (hovered = false)}
>
  <button
    class="chip"
    class:empty={!hasBody}
    style={`--layer:${layerColor}`}
    onclick={() => (editing = true)}
  >
    <span class="vlabel">{note.chapter}:{note.verse}</span>
    <span class="preview">
      {#if hasImage && !previewText}🖼 Image{:else}{hasBody ? previewText : 'Empty note'}{/if}
      {#if hasImage && previewText}<span class="imgtag"> · 🖼</span>{/if}
    </span>
  </button>

  {#if editing}
    <div class="pop editor" style={`--layer:${layerColor}`} onkeydown={(e) => { if (e.key === 'Escape') close(); }} role="presentation">
      <div class="pop-head">
        <span class="ref">{app.book?.name ?? ''} {note.chapter}:{note.verse}</span>
        <div class="actions">
          <button class="link danger" onclick={() => app.deleteNote(note.id)}>Delete</button>
          <button class="link" onclick={close}>Done</button>
        </div>
      </div>
      <RichNoteEditor
        html={isHtml ? note.body : textToHtml(note.body)}
        onchange={(h) => app.updateNote(note.id, h, 'html')}
      />
      <div class="hint"><kbd>Esc</kbd> or <kbd>Done</kbd> to save · paste or drop an image to embed it</div>
    </div>
  {:else if hovered && hasBody}
    <div class="pop read" style={`--layer:${layerColor}`}>
      <div class="ref">{app.book?.name ?? ''} {note.chapter}:{note.verse}</div>
      {#if isHtml}
        <div class="full rich">{@html sanitizeHtml(note.body)}</div>
      {:else}
        <div class="full">{note.body}</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .mnote {
    position: absolute;
    left: 0;
    right: 0;
  }
  .chip {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    color: #5f5344;
  }
  .mnote.right .chip {
    border-left: 2px solid var(--layer);
    padding: 0.1rem 0.1rem 0.1rem 0.55rem;
  }
  .mnote.left .chip {
    border-right: 2px solid var(--layer);
    padding: 0.1rem 0.55rem 0.1rem 0.1rem;
  }
  .vlabel {
    display: block;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--layer);
    line-height: 1.2;
  }
  .preview {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 0.78rem;
    line-height: 1.32;
    font-style: italic;
    color: #6b5d4b;
  }
  .imgtag {
    font-style: normal;
  }
  .chip.empty .preview {
    opacity: 0.55;
  }
  .chip:hover .preview {
    color: #2b2520;
  }

  .pop {
    position: absolute;
    top: -0.35rem;
    width: 280px;
    max-width: 40vw;
    background: #fffdf8;
    border: 1px solid #d8ccb4;
    border-left: 3px solid var(--layer);
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(43, 37, 32, 0.22);
    padding: 0.6rem 0.7rem;
    z-index: 20;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  .pop.editor {
    width: 440px;
    max-width: 60vw;
  }
  /* Expand toward the text (inward) so the card never runs off the page edge. */
  .mnote.right .pop {
    right: -0.25rem;
    left: auto;
  }
  .mnote.left .pop {
    left: -0.25rem;
    right: auto;
  }
  .pop .ref {
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--layer);
    margin-bottom: 0.3rem;
  }
  .pop .full {
    font-size: 0.86rem;
    line-height: 1.45;
    color: #2b2520;
    white-space: pre-wrap;
  }
  .pop .full.rich {
    white-space: normal;
  }
  .pop .full.rich :global(h3) {
    font-size: 0.95rem;
    margin: 0.3rem 0 0.2rem;
  }
  .pop .full.rich :global(blockquote) {
    margin: 0.3rem 0;
    padding-left: 0.6rem;
    border-left: 3px solid #d8ccb4;
    color: #5f5344;
  }
  .pop .full.rich :global(ul),
  .pop .full.rich :global(ol) {
    margin: 0.2rem 0;
    padding-left: 1.3rem;
  }
  .pop .full.rich :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    margin: 0.2rem 0;
  }
  .pop .full.rich :global(a) {
    color: #7a5230;
  }
  .pop-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.35rem;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
  }
  .link {
    background: none;
    border: none;
    font-size: 0.72rem;
    cursor: pointer;
    color: #6b5d4b;
    padding: 0;
  }
  .link.danger {
    color: #b03a2e;
  }
  .link:hover {
    text-decoration: underline;
  }
  .hint {
    margin-top: 0.4rem;
    font-size: 0.66rem;
    color: #a2937a;
  }
  .hint kbd {
    font-family: inherit;
    background: #efe7d6;
    border: 1px solid #ddd2bd;
    border-radius: 3px;
    padding: 0 0.25rem;
    font-size: 0.64rem;
  }
</style>
