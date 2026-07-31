import { cn } from "@/lib/utils";
import { SUB_TABS, type SubTab } from "@/lib/requestTabs";

interface SubTabSwitcherProps {
  activeSubTab: SubTab;
  onSelectSubTab: (tab: SubTab) => void;
}

export function SubTabSwitcher({ activeSubTab, onSelectSubTab }: SubTabSwitcherProps) {
  return (
    <div className="flex w-fit shrink-0 gap-1 rounded-lg bg-secondary p-1">
      {SUB_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onSelectSubTab(tab.id)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            activeSubTab === tab.id
              ? "border border-input bg-card text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
