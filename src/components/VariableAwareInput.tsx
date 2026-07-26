import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type Environment, VARIABLE_PATTERN, resolveVariable } from "@/lib/environments";

interface TokenPosition {
  name: string;
  startX: number;
  endX: number;
}

// A canvas 2D context is the standard way to measure how wide a string
// renders in a given font, without needing a real DOM element for it — one
// canvas is created lazily and reused across every measurement rather than
// per call.
let measureCanvas: HTMLCanvasElement | null = null;

function measureTokenPositions(value: string, font: string): TokenPosition[] {
  if (!measureCanvas) measureCanvas = document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d")!;
  ctx.font = font;
  const positions: TokenPosition[] = [];
  for (const match of value.matchAll(VARIABLE_PATTERN)) {
    const start = match.index ?? 0;
    positions.push({
      name: match[1],
      startX: ctx.measureText(value.slice(0, start)).width,
      endX: ctx.measureText(value.slice(0, start + match[0].length)).width,
    });
  }
  return positions;
}

interface HoverState {
  name: string;
  rect: DOMRect;
}

// A plain <input> plus {{varName}} detection: hovering over where a token
// renders shows a popup with its resolved value (editable) or an unresolved
// notice. Token positions come from measuring text width on a canvas
// (matching the input's own font), not from wrapping each token in its own
// <span> — an earlier version used a contentEditable div with real colored
// spans per token, but keeping that in sync with a `value` that can also
// change from *outside* the field (e.g. editing a Param rewrites the URL)
// proved fragile: a stale saved cursor offset could get restored into
// freshly-rendered content that didn't match what was actually typed,
// corrupting the text. A plain input has none of that risk — it owns its
// own cursor and scrolling natively.
export function VariableAwareInput({
  value,
  onChange,
  environment,
  onUpdateVariable,
  onOpenEnvironment,
  onOpenVariablesPanel,
  placeholder,
  ariaInvalid,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  environment: Environment | null;
  // Edits a variable's value directly from the hover popup, without opening
  // the full Environment editor — writes straight into the active
  // environment (by variable name), matching Postman's inline-edit UX.
  onUpdateVariable: (name: string, value: string) => void;
  // Jumps to the full Environment editor for the active environment — only
  // ever called while `environment` is non-null, since there's otherwise
  // nothing to jump to.
  onOpenEnvironment: () => void;
  // Opens the "Variables in request" side panel (all variables used in the
  // current request, plus the resulting cURL command).
  onOpenVariablesPanel: () => void;
  placeholder?: string;
  ariaInvalid?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fontRef = useRef("");
  const [hover, setHover] = useState<HoverState | null>(null);
  // The popup sits a few pixels below the token, so moving the mouse from
  // one to the other passes through a gap that would otherwise immediately
  // hide it before the cursor ever reaches the popup itself. Closing is
  // delayed slightly and cancelled if the popup picks up the hover in time.
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    if (!inputRef.current) return;
    const style = getComputedStyle(inputRef.current);
    fontRef.current = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  });

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

  function handleMouseMove(e: React.MouseEvent<HTMLInputElement>) {
    const input = inputRef.current;
    if (!input || !fontRef.current) return;
    const tokens = measureTokenPositions(value, fontRef.current);
    if (tokens.length === 0) {
      scheduleHide();
      return;
    }
    const rect = input.getBoundingClientRect();
    const paddingLeft = parseFloat(getComputedStyle(input).paddingLeft) || 0;
    const contentX = e.clientX - rect.left - paddingLeft + input.scrollLeft;
    const hit = tokens.find((t) => contentX >= t.startX && contentX <= t.endX);
    if (!hit) {
      scheduleHide();
      return;
    }
    cancelHide();
    const tokenLeft = rect.left + paddingLeft + hit.startX - input.scrollLeft;
    setHover((prev) =>
      prev && prev.name === hit.name && prev.rect.left === tokenLeft
        ? prev
        : { name: hit.name, rect: new DOMRect(tokenLeft, rect.top, hit.endX - hit.startX, rect.height) }
    );
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onMouseMove={handleMouseMove}
        onMouseLeave={scheduleHide}
        placeholder={placeholder}
        aria-invalid={ariaInvalid}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className={cn(
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className
        )}
      />

      {hover &&
        (() => {
          const resolved = resolveVariable(hover.name, environment);
          return createPortal(
            <div
              role="tooltip"
              className="fixed z-50 flex flex-col gap-1.5 rounded-md bg-popover p-2 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10"
              style={{ top: hover.rect.bottom + 4, left: hover.rect.left }}
              onMouseEnter={cancelHide}
              onMouseLeave={scheduleHide}
            >
              {resolved === null ? (
                <span className="font-mono text-destructive">{hover.name} is unresolved</span>
              ) : (
                <Input
                  className="h-7 px-1.5 py-0 font-mono text-xs"
                  size={Math.max(resolved.length, 1)}
                  value={resolved}
                  onChange={(e) => onUpdateVariable(hover.name, e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              )}
              <div className="flex items-center justify-between gap-2.5 whitespace-nowrap font-sans">
                {environment && (
                  <Button
                    type="button"
                    variant="link"
                    size="xs"
                    onClick={onOpenEnvironment}
                    className="h-auto p-0"
                  >
                    Edit environment
                  </Button>
                )}
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  onClick={onOpenVariablesPanel}
                  className="h-auto gap-1 p-0"
                >
                  Variables in request
                  <ArrowRight className="size-3" />
                </Button>
              </div>
            </div>,
            document.body
          );
        })()}
    </div>
  );
}
