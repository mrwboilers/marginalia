<script lang="ts">
  import { app } from '../store.svelte';
  import type { Verse } from '../types';

  let { verse }: { verse: Verse } = $props();

  const pieces = $derived(app.renderVerse(verse.v, verse.text));
  const isRed = $derived(verse.red && app.redLetter);

  function onPieceClick(markIds: string[]) {
    if (app.tool === 'erase' && markIds.length) {
      app.eraseMarks(markIds);
    }
  }
</script>

<sup class="vnum">{verse.v}</sup><span
  class="vtext"
  class:red={isRed}
  data-v={verse.v}
  >{#each pieces as piece}<span
      class="piece"
      class:underline={piece.underline}
      class:erasable={app.tool === 'erase' && piece.markIds.length}
      style={piece.highlight ? `background:${piece.highlight}` : ''}
      onclick={() => onPieceClick(piece.markIds)}
      role={app.tool === 'erase' && piece.markIds.length ? 'button' : undefined}
      tabindex={app.tool === 'erase' && piece.markIds.length ? 0 : undefined}
      onkeydown={(e) => e.key === 'Enter' && onPieceClick(piece.markIds)}
      >{piece.text}</span>{/each}</span>{' '}

<style>
  .vnum {
    font-size: 0.62em;
    font-weight: 700;
    color: #9a6a3a;
    vertical-align: super;
    line-height: 0;
    margin-right: 0.12em;
    user-select: none;
  }
  .vtext.red {
    color: #b03a2e;
  }
  .piece {
    /* highlight background sits behind the ink; slight padding softens edges */
    border-radius: 2px;
    padding: 0.02em 0;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  .piece.underline {
    text-decoration: underline;
    text-decoration-thickness: 0.09em;
    text-underline-offset: 0.14em;
    text-decoration-color: #7a5230;
  }
  .piece.erasable {
    cursor: pointer;
    outline: 1px dashed rgba(176, 58, 46, 0.6);
    outline-offset: 1px;
  }
</style>
