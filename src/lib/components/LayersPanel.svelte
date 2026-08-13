<script lang="ts">
  import { app } from '../store.svelte';
  import { LAYER_COLORS } from '../types';

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') app.closeLayers();
  }

  function markCount(layerId: string): number {
    return app.marks.filter((m) => m.layerId === layerId).length + app.notes.filter((n) => n.layerId === layerId).length;
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="overlay" onclick={() => app.closeLayers()} role="presentation">
  <div class="panel" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Layers">
    <div class="head">
      <div class="title">Layers</div>
      <button class="close" aria-label="Close" onclick={() => app.closeLayers()}>×</button>
    </div>

    <div class="list">
      {#each app.layers as layer (layer.id)}
        <div class="layer" class:active={layer.id === app.activeLayerId}>
          <div class="top">
            <label class="vis" title="Show this layer">
              <input type="checkbox" checked={layer.visible} onchange={() => app.toggleLayer(layer.id)} />
            </label>
            <input
              class="name"
              value={layer.name}
              aria-label="Layer name"
              oninput={(e) => app.renameLayer(layer.id, (e.target as HTMLInputElement).value)}
            />
            <button
              class="active-btn"
              class:on={layer.id === app.activeLayerId}
              onclick={() => app.setActiveLayer(layer.id)}
            >{layer.id === app.activeLayerId ? '● Active' : 'Set active'}</button>
            <button
              class="del"
              aria-label={`Delete ${layer.name}`}
              disabled={app.layers.length <= 1}
              title={app.layers.length <= 1 ? "Can't delete the only layer" : `Delete layer and its ${markCount(layer.id)} markings`}
              onclick={() => { if (confirm(`Delete "${layer.name}" and its ${markCount(layer.id)} markings?`)) app.deleteLayer(layer.id); }}
            >🗑</button>
          </div>
          <div class="swatches">
            {#each LAYER_COLORS as c (c)}
              <button
                class="swatch"
                class:selected={layer.color === c}
                style={`background:${c}`}
                aria-label={`Set color ${c}`}
                onclick={() => app.setLayerColor(layer.id, c)}
              ></button>
            {/each}
          </div>
        </div>
      {/each}
    </div>

    <div class="foot">
      <button class="add" onclick={() => app.addLayer()}>+ Add layer</button>
      <span class="hint">Marks and notes are saved to the active layer. Hide a layer to hide all its markings.</span>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(43, 37, 32, 0.35);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 9vh;
    z-index: 50;
  }
  .panel {
    width: min(480px, 94vw);
    max-height: 78vh;
    display: flex;
    flex-direction: column;
    background: #f4efe2;
    border: 1px solid #cbbfa8;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.85rem 1rem;
    border-bottom: 1px solid #ddd2bd;
  }
  .title {
    font-family: 'Iowan Old Style', Palatino, Georgia, serif;
    font-size: 1.15rem;
    color: #2b2520;
  }
  .close {
    border: none;
    background: none;
    font-size: 1.6rem;
    line-height: 1;
    color: #8a7c66;
    cursor: pointer;
    padding: 0 0.2rem;
  }
  .list {
    overflow-y: auto;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .layer {
    border: 1px solid #e0d6c0;
    border-radius: 9px;
    padding: 0.5rem 0.6rem;
    background: #fffdf8;
  }
  .layer.active {
    border-color: #a4906f;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .name {
    flex: 1;
    min-width: 0;
    font: inherit;
    font-size: 0.92rem;
    padding: 0.3rem 0.4rem;
    border: 1px solid #e0d6c0;
    border-radius: 6px;
    background: #fffefb;
    color: #2b2520;
  }
  .active-btn {
    font: inherit;
    font-size: 0.72rem;
    padding: 0.3rem 0.5rem;
    border: 1px solid #c3b69c;
    border-radius: 6px;
    background: #fbf8f0;
    color: #6b5d4b;
    cursor: pointer;
    white-space: nowrap;
  }
  .active-btn.on {
    background: #2b2520;
    color: #f4efe2;
    border-color: #2b2520;
    cursor: default;
  }
  .del {
    border: none;
    background: none;
    cursor: pointer;
    font-size: 0.95rem;
    padding: 0.2rem;
  }
  .del:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .swatches {
    display: flex;
    gap: 0.3rem;
    margin-top: 0.5rem;
  }
  .swatch {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid rgba(0, 0, 0, 0.12);
    cursor: pointer;
    padding: 0;
  }
  .swatch.selected {
    border-color: #2b2520;
    box-shadow: 0 0 0 2px #fffdf8, 0 0 0 3px #2b2520;
  }
  .foot {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid #ddd2bd;
  }
  .add {
    font: inherit;
    font-size: 0.85rem;
    padding: 0.4rem 0.75rem;
    border: 1px solid #c3b69c;
    border-radius: 7px;
    background: #efe7d6;
    color: #2b2520;
    cursor: pointer;
    white-space: nowrap;
  }
  .hint {
    font-size: 0.7rem;
    color: #8a7c66;
    line-height: 1.35;
  }
</style>
