import { useState, type CSSProperties } from "react";

export interface TextSelectionRange {
  start: number;
  end: number;
}

// Tracks the real input/textarea's current selection range (null when
// collapsed to a plain caret). The overlay uses this to draw its OWN
// selection highlight instead of relying on the browser's native
// ::selection — native selection paints only on the real (invisible) text
// underneath the overlay, so it has no way to react to a token's color;
// no choice of native selection color can be reliably correct against an
// arbitrary token color sitting on top of it. Drawing the highlight
// ourselves lets us force a legible foreground on exactly the selected
// text, regardless of whether it's plain or a colored {{token}} — the same
// approach real code editors use for this exact reason.
export function useTextSelection() {
  const [selection, setSelection] = useState<TextSelectionRange | null>(null);

  function updateFromElement(el: HTMLInputElement | HTMLTextAreaElement) {
    const { selectionStart, selectionEnd } = el;
    // Bail out (keep the same object) when nothing actually changed —
    // during a drag this runs on every mousemove tick, and without this
    // check a same-position tick still hands React a brand new object
    // reference, forcing a full re-render (retokenize + rebuild every
    // span) for no visible difference. Matters most for a large body.
    setSelection((prev) => {
      if (selectionStart === null || selectionEnd === null || selectionStart === selectionEnd) {
        return prev === null ? prev : null;
      }
      if (prev && prev.start === selectionStart && prev.end === selectionEnd) return prev;
      return { start: selectionStart, end: selectionEnd };
    });
  }

  // A native input hides its selection highlight the moment it loses focus
  // — this field's range is still there internally (the browser remembers
  // it), but nothing should render it once the user has moved on to select
  // something elsewhere. Without this, every field you've ever selected
  // text in keeps showing its highlight forever, since nothing else here
  // ever clears it — looking exactly like several fields are all selected
  // "at once".
  function clearOnBlur() {
    setSelection(null);
  }

  return { selection, updateFromElement, clearOnBlur };
}

// Guards against a selection range computed against a previous, longer
// `value` (e.g. a Param edit elsewhere rewrites the URL out from under an
// existing selection) — clamps to the current text length instead of
// slicing with stale/out-of-range indices.
export function clampSelection(selection: TextSelectionRange | null, textLength: number): TextSelectionRange | null {
  if (!selection || selection.start >= textLength) return null;
  return { start: Math.min(selection.start, textLength), end: Math.min(selection.end, textLength) };
}

// Splits `text` (which starts at `absStart` in the full value) into runs
// tagged with whether each run falls inside `selection` — a run with
// `selected: true` should render with SELECTED_TEXT_STYLE, overriding
// whatever color it would otherwise have.
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

// A solid background + a guaranteed-contrasting foreground, so selected
// text stays legible no matter what color it would otherwise render in.
// No border-radius: a selection is rendered as several adjacent <span>s
// (one per token/plain run) rather than one continuous element — rounding
// each individually leaves a visible seam/gap where two selected spans
// meet, instead of one seamless bar. A flat rectangle merges cleanly across
// adjacent spans regardless of how many of them make it up.
export const SELECTED_TEXT_STYLE: CSSProperties = {
  backgroundColor: "var(--color-ring)",
  color: "var(--color-background)",
};
