import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KeyValuePair } from "@/lib/keyValue";

export const KeyValueEditor = memo(function KeyValueEditor({
  rows,
  onUpdate,
  onRemove,
}: {
  rows: KeyValuePair[];
  onUpdate: (index: number, patch: Partial<KeyValuePair>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="w-4" />
        <span className="flex-1">Key</span>
        <span className="flex-1">Value</span>
        <span className="w-8" />
      </div>
      {rows.map((row, index) => {
        const isTrailingEmpty =
          index === rows.length - 1 && row.key.trim() === "" && row.value.trim() === "";
        return (
          <div key={row.id} className={cn("flex items-center gap-2", !row.enabled && "opacity-50")}>
            <Checkbox
              checked={row.enabled}
              onCheckedChange={(checked) => onUpdate(index, { enabled: checked === true })}
              aria-label={`Include ${row.key} in request`}
              className={isTrailingEmpty ? "invisible" : undefined}
            />
            <Input
              className="font-mono"
              placeholder="key"
              value={row.key}
              onChange={(e) => onUpdate(index, { key: e.target.value })}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <Input
              className="font-mono"
              placeholder="value"
              value={row.value}
              onChange={(e) => onUpdate(index, { value: e.target.value })}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemove(index)}
              aria-label="Remove row"
              className={isTrailingEmpty ? "invisible" : undefined}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
});
