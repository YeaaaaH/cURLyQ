import { useState, type CSSProperties } from "react";

export interface TextSelectionRange {
  start: number;
  end: number;
}

// The overlay draws its own selection: native ::selection paints the invisible text
// underneath, which can't contrast with colored tokens.
export function useTextSelection() {
  const [selection, setSelection] = useState<TextSelectionRange | null>(null);

  function updateFromElement(el: HTMLInputElement | HTMLTextAreaElement) {
    const { selectionStart, selectionEnd } = el;
    // Same object when unchanged — this runs on every mousemove during a drag.
    setSelection((prev) => {
      if (selectionStart === null || selectionEnd === null || selectionStart === selectionEnd) {
        return prev === null ? prev : null;
      }
      if (prev && prev.start === selectionStart && prev.end === selectionEnd) return prev;
      return { start: selectionStart, end: selectionEnd };
    });
  }

  // Otherwise every previously selected field keeps its highlight.
  function clearOnBlur() {
    setSelection(null);
  }

  return { selection, updateFromElement, clearOnBlur };
}

// The value can shrink under an existing selection (e.g. a Param edit rewrites the URL).
export function clampSelection(selection: TextSelectionRange | null, textLength: number): TextSelectionRange | null {
  if (!selection || selection.start >= textLength) return null;
  return { start: Math.min(selection.start, textLength), end: Math.min(selection.end, textLength) };
}

export function splitBySelection(
  text: string,
  absStart: number,
  selection: TextSelectionRange | null
): { text: string; selected: boolean }[] {
  if (!selection || selection.end <= absStart || selection.start >= absStart + text.length) {
    return [{ text, selected: false }];
  }
  const relStart = Math.max(0, selection.start - absStart);
  const relEnd = Math.min(text.length, selection.end - absStart);
  const parts: { text: string; selected: boolean }[] = [];
  if (relStart > 0) parts.push({ text: text.slice(0, relStart), selected: false });
  parts.push({ text: text.slice(relStart, relEnd), selected: true });
  if (relEnd < text.length) parts.push({ text: text.slice(relEnd), selected: false });
  return parts;
}

// No border-radius: adjacent selected spans would show seams.
export const SELECTED_TEXT_STYLE: CSSProperties = {
  backgroundColor: "var(--color-ring)",
  color: "var(--color-background)",
};
