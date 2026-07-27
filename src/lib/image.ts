// Turn a user-supplied image File/Blob into a downscaled data URI, so it can be
// embedded directly in a note's HTML and travel inside the export JSON. Runs in
// the browser (canvas). Large photos are capped so notes don't bloat storage.

const MAX_DIM = 1024; // longest edge, in px

/** Load a Blob into an HTMLImageElement. */
function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image'));
    };
    img.src = url;
  });
}

/**
 * Downscale (if needed) and re-encode an image blob to a data URI. GIFs are kept
 * as-is (canvas would flatten animation); everything else is re-encoded to JPEG,
 * except images with alpha, which stay PNG.
 */
export async function imageToDataUrl(blob: Blob): Promise<string> {
  if (blob.type === 'image/gif') return blobToDataUrl(blob);

  const img = await loadImage(blob);
  const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return blobToDataUrl(blob);
  ctx.drawImage(img, 0, 0, w, h);

  const keepAlpha = blob.type === 'image/png' || blob.type === 'image/webp';
  return canvas.toDataURL(keepAlpha ? 'image/png' : 'image/jpeg', 0.85);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(blob);
  });
}
