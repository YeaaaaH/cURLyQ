import { useRef, useState } from "react";
import { tokenizeVariables } from "@/lib/variables";

export interface HoverState {
  name: string;
  rect: DOMRect;
}

export function useVariableTokenHover(value: string) {
  const tokenSpanRefs = useRef<Map<number, HTMLSpanElement>>(new Map());
  const [hover, setHover] = useState<HoverState | null>(null);
  // Delayed close, so crossing the gap from token to popup doesn't hide it.
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
    // Skip hit-testing during a drag: getBoundingClientRect forces layout on every move.
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
