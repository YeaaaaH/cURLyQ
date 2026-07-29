import { useEffect, useRef, useState } from "react";
import { SPLIT_MAX_HEIGHT_RATIO, SPLIT_MIN_HEIGHT_PX } from "./constants";

interface DragState {
  startY: number;
  startHeight: number;
  minHeight: number;
  maxHeight: number;
}

// Drives the resizable divider between the Collections and Environments
// sections — null height means "use the default (content-sized, capped at
// 50%)" behavior; once dragged, a fixed pixel height takes over.
export function useCollectionsSplit() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<DragState | null>(null);

  function onSplitPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const startHeight = wrapper.getBoundingClientRect().height;
    const containerHeight = wrapper.parentElement?.getBoundingClientRect().height ?? startHeight * 2;
    dragStateRef.current = {
      startY: event.clientY,
      startHeight,
      minHeight: SPLIT_MIN_HEIGHT_PX,
      maxHeight: Math.max(SPLIT_MIN_HEIGHT_PX, containerHeight * SPLIT_MAX_HEIGHT_RATIO),
    };
    setIsDragging(true);
  }

  // Listeners live in an effect keyed on isDragging rather than being added
  // imperatively in the pointerdown handler, so cleanup runs both on
  // pointerup and if the component unmounts mid-drag.
  useEffect(() => {
    if (!isDragging) return;

    function handlePointerMove(moveEvent: PointerEvent) {
      const drag = dragStateRef.current;
      if (!drag) return;
      const next = Math.min(drag.maxHeight, Math.max(drag.minHeight, drag.startHeight + (moveEvent.clientY - drag.startY)));
      setHeight(next);
    }
    function handlePointerUp() {
      setIsDragging(false);
    }

    // Also ends the drag on pointercancel — without it, an interrupted drag
    // (e.g. losing focus mid-drag) would leave `isDragging` stuck true
    // forever, since nothing else flips it back to false and this component
    // never unmounts to run the cleanup below on its own.
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerUp);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isDragging]);

  return { wrapperRef, height, isDragging, onSplitPointerDown };
}
