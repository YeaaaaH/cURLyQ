import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { METHOD_COLORS } from "@/lib/http";
import type { RequestTab } from "@/lib/requestTabs";
import { X } from "lucide-react";

interface RequestTabItemProps {
  tab: RequestTab;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
  // React 19 lets a function component accept `ref` as a plain prop —
  // no forwardRef wrapper needed.
  ref?: React.Ref<HTMLDivElement>;
}

function RequestTabItem({ tab, active, onSelect, onClose, ref }: RequestTabItemProps) {
  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      className={cn(
        "flex shrink-0 cursor-default items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
        active ? "border border-input bg-background" : "bg-secondary text-muted-foreground hover:text-foreground"
      )}
    >
      <span className={cn("text-xs font-semibold", METHOD_COLORS[tab.method])}>{tab.method}</span>
      <span className={active ? "text-foreground" : undefined}>{tab.name}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label={`Close ${tab.name}`}
        className="rounded p-0.5 text-muted-foreground/70 hover:bg-muted hover:text-foreground"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

interface RequestTabListProps {
  requests: readonly RequestTab[];
  activeId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
}

export function RequestTabList({ requests, activeId, onSelectTab, onCloseTab }: RequestTabListProps) {
  // The tab strip scrolls horizontally once there are more tabs than fit —
  // switching the active tab programmatically (e.g. clicking a request in
  // the collection tree that's already open) previously left it selected but
  // scrolled out of view, with no indication anything changed. `block:
  // "nearest"`/`inline: "nearest"` keeps this to the strip's own horizontal
  // scroll, since <main>'s ancestors are all overflow-hidden/fixed and can't
  // scroll anyway.
  const tabRefs = useRef(new Map<string, HTMLDivElement>());
  useEffect(() => {
    tabRefs.current.get(activeId)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId]);

  function registerTabElement(id: string, element: HTMLDivElement | null) {
    if (element) tabRefs.current.set(id, element);
    else tabRefs.current.delete(id);
  }

  // The strip is wider than it is tall and has no vertical scroll of its
  // own, so a vertical wheel gesture scrolls it horizontally instead.
  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (e.deltaY === 0) return;
    e.currentTarget.scrollLeft += e.deltaY;
  }

  return (
    <div className="scrollbar-none flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto" onWheel={handleWheel}>
      {requests.map((tab) => (
        <RequestTabItem
          key={tab.id}
          ref={(element) => registerTabElement(tab.id, element)}
          tab={tab}
          active={tab.id === activeId}
          onSelect={() => onSelectTab(tab.id)}
          onClose={() => onCloseTab(tab.id)}
        />
      ))}
    </div>
  );
}
