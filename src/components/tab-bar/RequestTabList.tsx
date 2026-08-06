import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { METHOD_COLORS } from "@/lib/http";
import type { Tab } from "@/lib/tabs";
import { ListChecks, X } from "lucide-react";

interface RequestTabItemProps {
  tab: Tab;
  active: boolean;
  dirty: boolean;
  onSelect: () => void;
  onClose: () => void;
  // React 19 lets a function component accept `ref` as a plain prop —
  // no forwardRef wrapper needed.
  ref?: React.Ref<HTMLDivElement>;
}

function RequestTabItem({ tab, active, dirty, onSelect, onClose, ref }: RequestTabItemProps) {
  const name = tab.type === "request" ? tab.name : tab.label;
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
        "flex shrink-0 cursor-default items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring-glow",
        active
          ? "border border-border bg-card"
          : "border border-transparent bg-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {tab.type === "request" ? (
        <span className={cn("text-xs font-semibold", METHOD_COLORS[tab.method])}>{tab.method}</span>
      ) : (
        <ListChecks className="size-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className={cn("min-w-0 max-w-[120px] truncate", active && "text-foreground")} title={name}>
        {name}
      </span>
      {dirty && (
        <span
          className="size-1.5 shrink-0 rounded-full bg-muted-foreground/70"
          role="img"
          aria-label="Unsaved changes"
          title="Unsaved changes"
        />
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label={`Close ${name}`}
        className="rounded p-1 text-muted-foreground/70 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring-glow"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

interface RequestTabListProps {
  tabs: readonly Tab[];
  activeId: string;
  dirtyTabIds: ReadonlySet<string>;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
}

export function RequestTabList({ tabs, activeId, dirtyTabIds, onSelectTab, onCloseTab }: RequestTabListProps) {
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
      {tabs.map((tab) => (
        <RequestTabItem
          key={tab.id}
          ref={(element) => registerTabElement(tab.id, element)}
          tab={tab}
          active={tab.id === activeId}
          dirty={dirtyTabIds.has(tab.id)}
          onSelect={() => onSelectTab(tab.id)}
          onClose={() => onCloseTab(tab.id)}
        />
      ))}
    </div>
  );
}
