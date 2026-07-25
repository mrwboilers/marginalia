<script lang="ts">
  import { app } from '../store.svelte';
  import type { Note } from '../types';

  let {
    note,
    top,
    open = false,
    side = 'right',
  }: { note: Note; top: number; open?: boolean; side?: 'left' | 'right' } = $props();

  let editing = $state(false);
  let hovered = $state(false);
  let ta: HTMLTextAreaElement | undefined = $state();

  const layerColor = $derived(app.layers.find((l) => l.id === note.layerId)?.color ?? '#8a7c66');
  const hasBody = $derived(note.body.trim().length > 0);

  // Auto-open the editor when the note is freshly created via the Note tool.
  $effect(() => {
    if (open) editing = true;
  });
  $effect(() => {
    if (editing && ta) ta.focus();
  });

  function close() {
    editing = false;
    // Don't leave an empty chip behind if the note was never written.
    if (!note.body.trim()) app.deleteNote(note.id);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
      return;
    }
    // Enter saves & closes; Shift+Enter inserts a newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      close();
    }
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
    <span class="preview">{hasBody ? note.body : 'Empty note'}</span>
  </button>

  {#if editing}
    <div class="pop editor" style={`--layer:${layerColor}`}>
      <div class="pop-head">
        <span class="ref">{app.book?.name ?? ''} {note.chapter}:{note.verse}</span>
        <div class="actions">
          <button class="link danger" onclick={() => app.deleteNote(note.id)}>Delete</button>
          <button class="link" onclick={close}>Done</button>
        </div>
      </div>
      <textarea
        bind:this={ta}
        value={note.body}
        placeholder="Write your note…"
        oninput={(e) => app.updateNote(note.id, (e.target as HTMLTextAreaElement).value)}
        onkeydown={onKey}
      ></textarea>
      <div class="hint"><kbd>Enter</kbd> to save · <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line</div>
    </div>
  {:else if hovered && hasBody}
    <div class="pop read" style={`--layer:${layerColor}`}>
      <div class="ref">{app.book?.name ?? ''} {note.chapter}:{note.verse}</div>
      <div class="full">{note.body}</div>
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
  textarea {
    width: 100%;
    min-height: 5rem;
    resize: vertical;
    border: 1px solid #e0d6c0;
    border-radius: 6px;
    padding: 0.45rem 0.5rem;
    font: inherit;
    font-size: 0.86rem;
    line-height: 1.45;
    color: #2b2520;
    background: #fffefb;
  }
  textarea:focus {
    outline: 2px solid #c9b892;
    border-color: transparent;
  }
  .hint {
    margin-top: 0.35rem;
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
