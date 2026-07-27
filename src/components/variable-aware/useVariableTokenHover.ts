import { useRef, useState } from "react";
import { tokenizeVariables } from "@/lib/variables";

export interface HoverState {
  name: string;
  rect: DOMRect;
}

// Shared by VariableAwareInput and VariableAwareTextarea: tracks which
// {{token}} (if any) the mouse is currently over, using the real rendered
// position of each token's overlay <span> (via `registerTokenSpan`) rather
// than any font/layout approximation — works the same whether the tokens
// sit on one line or are wrapped across several.
export function useVariableTokenHover(value: string) {
  const tokenSpanRefs = useRef<Map<number, HTMLSpanElement>>(new Map());
  const [hover, setHover] = useState<HoverState | null>(null);
  // The popup sits a few pixels below the token, so moving the mouse from
  // one to the other passes through a gap that would otherwise immediately
  // hide it before the cursor ever reaches the popup itself. Closing is
  // delayed slightly and cancelled if the popup picks up the hover in time.
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tokens = tokenizeVariables(value);

  function cancelHide() {
    if (hideTimeoutRef.current !== null) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }

  function scheduleHide() {
    cancelHide();
    hideTimeoutRef.current = setTimeout(() => setHover(null), 200);
  }

  function handleMouseMove(e: { clientX: number; clientY: number; buttons: number }) {
    // e.buttons !== 0 means a mouse button is currently held — i.e. this
    // mousemove is part of a drag (almost always a text-selection drag
    // here), not a hover. Hit-testing every token's getBoundingClientRect()
    // forces a synchronous layout pass per call; doing that on every single
    // mousemove tick throughout a drag (when the event fires very rapidly)
    // is a real, visible cost for no benefit — hover detection is
    // irrelevant while the user is actively selecting text.
    if (e.buttons !== 0 || tokens.length === 0) {
      scheduleHide();
      return;
    }
    let hitIndex = -1;
    let hitRect: DOMRect | null = null;
    for (let i = 0; i < tokens.length; i++) {
      const span = tokenSpanRefs.current.get(i);
      if (!span) continue;
      const rect = span.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        hitIndex = i;
        hitRect = rect;
        break;
      }
    }
    if (hitIndex === -1 || !hitRect) {
      scheduleHide();
      return;
    }
    cancelHide();
    const name = tokens[hitIndex].name;
    const rect = hitRect;
    setHover((prev) =>
      prev && prev.name === name && prev.rect.left === rect.left && prev.rect.top === rect.top ? prev : { name, rect }
    );
  }

  function registerTokenSpan(index: number, el: HTMLSpanElement | null) {
    if (el) tokenSpanRefs.current.set(index, el);
    else tokenSpanRefs.current.delete(index);
  }

  return { tokens, hover, handleMouseMove, scheduleHide, cancelHide, registerTokenSpan };
}
