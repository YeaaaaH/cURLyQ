import { useCallback, useState } from "react";

const DRAG_THRESHOLD_PX = 48;

// Shared drag-to-open behavior for the left Sidebar and right VariablesPanel
// edge handles: a short pull past the threshold snaps the panel straight
// open (not a continuous pixel-by-pixel resize), and pulling back the other
// way snaps it shut. `side` flips which direction opens vs. closes, since
// the two panels sit on opposite edges of the window.
export function useEdgeDragPanel(side: "left" | "right") {
  const [open, setOpen] = useState(false);

  // Memoized (only changes identity when `open` itself toggles, not on every
  // render) so it stays a stable prop for React.memo'd consumers like
  // Sidebar — see useCollections.ts/useEnvironments.ts for the same
  // treatment applied to the rest of Sidebar's props.
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
    // Also ends the drag on pointercancel — without it, an interrupted drag
    // (e.g. losing focus mid-drag) would leave these document listeners
    // attached permanently, stacking more of them on every later attempt.
    function handlePointerEnd() {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerEnd);
      document.removeEventListener("pointercancel", handlePointerEnd);
    }
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerEnd);
    document.addEventListener("pointercancel", handlePointerEnd);
  }, [open, side]);

  return { open, setOpen, onHandlePointerDown };
}
