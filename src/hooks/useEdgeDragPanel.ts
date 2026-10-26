import { useCallback, useState } from "react";

const DRAG_THRESHOLD_PX = 48;

// Snaps open/closed past a threshold rather than resizing continuously.
export function useEdgeDragPanel(side: "left" | "right") {
  const [open, setOpen] = useState(false);

  const onHandlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const wasOpen = open;
    let toggled = false;

    function handlePointerMove(moveEvent: PointerEvent) {
      if (toggled) return;
      const delta = moveEvent.clientX - startX;
      const opens = side === "left" ? delta > DRAG_THRESHOLD_PX : delta < -DRAG_THRESHOLD_PX;
      const closes = side === "left" ? delta < -DRAG_THRESHOLD_PX : delta > DRAG_THRESHOLD_PX;
      if (!wasOpen && opens) {
        setOpen(true);
        toggled = true;
      } else if (wasOpen && closes) {
        setOpen(false);
        toggled = true;
      }
    }
    // Set on <body> so the cursor doesn't flicker once the pointer leaves the thin handle.
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "ew-resize";

    // pointercancel too, or an interrupted drag would leak these listeners.
    function handlePointerEnd() {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerEnd);
      document.removeEventListener("pointercancel", handlePointerEnd);
      document.body.style.cursor = previousCursor;
    }
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerEnd);
    document.addEventListener("pointercancel", handlePointerEnd);
  }, [open, side]);

  return { open, setOpen, onHandlePointerDown };
}
