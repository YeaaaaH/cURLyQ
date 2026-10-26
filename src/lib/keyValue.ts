export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

// Params/Headers always keep exactly one trailing empty row to type into.
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

export function stripEmptyRows(rows: KeyValuePair[]): KeyValuePair[] {
  return rows.filter(({ key, value }) => key.trim() !== "" || value.trim() !== "");
}

export function ensureTrailingBlankRow(rows: KeyValuePair[]): KeyValuePair[] {
  const last = rows[rows.length - 1];
  if (!last || last.key.trim() !== "" || last.value.trim() !== "") {
    return [...rows, { id: crypto.randomUUID(), key: "", value: "", enabled: true }];
  }
  return rows;
}
