export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

// Shared self-growing-row logic for Params/Headers: always keeps exactly one
// trailing empty row in state so there's a stable place to type a new entry.
export function updateRows(
  rows: KeyValuePair[],
  index: number,
  patch: Partial<KeyValuePair>
): KeyValuePair[] {
  const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
  const last = next[next.length - 1];
  if (last.key.trim() !== "" || last.value.trim() !== "") {
    next.push({ id: crypto.randomUUID(), key: "", value: "", enabled: true });
  }
  return next;
}

export function removeRow(rows: KeyValuePair[], index: number): KeyValuePair[] {
  const remaining = rows.filter((_, i) => i !== index);
  return remaining.length > 0
    ? remaining
    : [{ id: crypto.randomUUID(), key: "", value: "", enabled: true }];
}

// The self-growing-row pattern always keeps a blank trailing row in live UI
// state so there's somewhere to type a new entry — but that row shouldn't be
// written to disk until it actually has a key or value.
export function stripEmptyRows(rows: KeyValuePair[]): KeyValuePair[] {
  return rows.filter(({ key, value }) => key.trim() !== "" || value.trim() !== "");
}

// Reverse of stripEmptyRows, applied after loading persisted rows — restores
// the invariant the self-growing-row pattern expects (a blank row to type
// into), since a saved row list may have none (fully stripped) or end in a
// filled-in row.
export function ensureTrailingBlankRow(rows: KeyValuePair[]): KeyValuePair[] {
  const last = rows[rows.length - 1];
  if (!last || last.key.trim() !== "" || last.value.trim() !== "") {
    return [...rows, { id: crypto.randomUUID(), key: "", value: "", enabled: true }];
  }
  return rows;
}
