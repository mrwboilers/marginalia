/**
 * Order the selected comparison translations so the reader's current translation
 * is always column 1 (when it's among the selected), followed by the remaining
 * selected translations in canonical order. Pure so it can be unit-tested and so
 * every place that (re)builds the column order stays consistent.
 *
 * @param selectedIds   the translation ids currently chosen (any order)
 * @param currentId     the reader's current translation id
 * @param canonicalOrder all translation ids in canonical (registry) order
 */
export function orderSelected(
  selectedIds: number[],
  currentId: number,
  canonicalOrder: number[]
): number[] {
  const rank = (id: number) => {
    const i = canonicalOrder.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const rest = selectedIds.filter((id) => id !== currentId).sort((a, b) => rank(a) - rank(b));
  return selectedIds.includes(currentId) ? [currentId, ...rest] : rest;
}
