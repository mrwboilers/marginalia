<script lang="ts">
  import { app } from '../store.svelte';
  import StrongNum from './StrongNum.svelte';
  import type { RenderPiece } from '../store.svelte';
  import type { Verse } from '../types';

  let { verse }: { verse: Verse } = $props();

  const isRed = $derived(verse.red && app.redLetter);
  const strongMode = $derived(app.strongsOn && !!app.strongsFor(verse.v));
  const pieces = $derived(app.renderVerse(verse.v, verse.text));
  const strongItems = $derived(strongMode ? app.renderStrongVerse(verse.v) : []);

  function onPieceClick(markIds: string[]) {
    if (app.tool === 'erase' && markIds.length) {
      app.eraseMarks(markIds);
    }
  }
</script>

{#snippet pieceView(piece: RenderPiece)}
  <span
    class="piece"
    class:underline={piece.underline}
    class:erasable={app.tool === 'erase' && piece.markIds.length}
    style={piece.highlight ? `background:${piece.highlight}` : ''}
    onclick={() => onPieceClick(piece.markIds)}
    role={app.tool === 'erase' && piece.markIds.length ? 'button' : undefined}
    tabindex={app.tool === 'erase' && piece.markIds.length ? 0 : undefined}
    onkeydown={(e) => e.key === 'Enter' && onPieceClick(piece.markIds)}
    >{piece.text}</span
  >
{/snippet}

<sup
  class="vnum"
  role="button"
  tabindex="0"
  title="Copy verse with reference"
  onclick={() => app.copyVerse(verse.v)}
  onkeydown={(e) => e.key === 'Enter' && app.copyVerse(verse.v)}
>{verse.v}</sup><span
  class="vtext"
  class:red={isRed}
  class:strong-mode={strongMode}
  data-v={verse.v}
  >{#if strongMode}{#each strongItems as item}{#if 'strongs' in item}{#each item.strongs as n, i (i)}<StrongNum
            num={n}
          />{/each}{:else}{@render pieceView(item)}{/if}{/each}{:else}{#each pieces as piece}{@render pieceView(
        piece
      )}{/each}{/if}</span
>{' '}

<style>
  .vnum {
    font-size: 0.62em;
    font-weight: 700;
    color: #9a6a3a;
    vertical-align: super;
    line-height: 0;
    margin-right: 0.12em;
    user-select: none;
    cursor: pointer;
    border: none;
    background: none;
    padding: 0;
  }
  .vnum:hover {
    color: #7a5230;
    text-decoration: underline;
  }
  .vtext.red {
    color: #b03a2e;
  }
  /* Strong's numbers add height; a little extra leading keeps lines even. */
  .vtext.strong-mode {
    line-height: 2.1;
  }
  .piece {
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
