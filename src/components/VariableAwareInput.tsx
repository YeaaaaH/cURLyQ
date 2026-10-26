import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { Environment } from "@/lib/environments";
import { resolveVariable, type VariableLookup, type VariableToken } from "@/lib/variables";
import { useVariableTokenHover } from "@/components/variable-aware/useVariableTokenHover";
import { VariableHoverPopup } from "@/components/variable-aware/VariableHoverPopup";
import {
  SELECTED_TEXT_STYLE,
  clampSelection,
  splitBySelection,
  useTextSelection,
} from "@/components/variable-aware/useTextSelection";

// A native <input> can't color part of its text, so its text is transparent and a
// non-interactive overlay renders the same text with colored {{var}} spans.
export function VariableAwareInput({
  value,
  onChange,
  environment,
  variableContext,
  onUpdateVariable,
  onCreateVariable,
  onOpenEnvironment,
  onOpenVariablesPanel,
  placeholder,
  ariaInvalid,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  environment: Environment | null;
  variableContext: VariableLookup;
  onUpdateVariable: (name: string, value: string) => void;
  onCreateVariable: (name: string) => void;
  onOpenEnvironment: () => void;
  onOpenVariablesPanel: () => void;
  placeholder?: string;
  ariaInvalid?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const { tokens, hover, handleMouseMove, scheduleHide, cancelHide, registerTokenSpan } = useVariableTokenHover(value);
  const { selection, updateFromElement, clearOnBlur } = useTextSelection();
  const clampedSelection = clampSelection(selection, value.length);

  // Read a frame later: after a click, the browser may not have collapsed the old
  // selection yet when mouseup/select fire.
  function handleSelect() {
    requestAnimationFrame(() => {
      if (inputRef.current) updateFromElement(inputRef.current);
    });
  }

  // Drag-select doesn't fire live "select" events in this webview.
  function handleMouseMoveWithSelection(e: React.MouseEvent<HTMLInputElement>) {
    if (e.buttons !== 0) updateFromElement(e.currentTarget);
    handleMouseMove(e);
  }

  useLayoutEffect(() => {
    if (inputRef.current && overlayRef.current) {
      overlayRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  });

  function syncOverlayScroll(e: React.UIEvent<HTMLInputElement>) {
    if (overlayRef.current) overlayRef.current.scrollLeft = e.currentTarget.scrollLeft;
  }

  function renderRun(text: string, absStart: number, color?: string): React.ReactNode[] {
    return splitBySelection(text, absStart, clampedSelection).map((part, i) => (
      <span key={`${absStart}-${i}`} style={part.selected ? SELECTED_TEXT_STYLE : color ? { color } : undefined}>
        {part.text}
      </span>
    ));
  }

  function renderOverlaySegments(text: string, tokenList: VariableToken[]) {
    const segments: React.ReactNode[] = [];
    let cursor = 0;
    tokenList.forEach((token, i) => {
      if (token.start > cursor) segments.push(...renderRun(text.slice(cursor, token.start), cursor));
      const resolution = resolveVariable(token.name, variableContext);
      const tokenColor =
        resolution.kind === "resolved"
          ? "var(--color-variable-resolved)"
          : resolution.kind === "circular"
            ? "var(--color-variable-circular)"
            : "var(--color-destructive)";
      segments.push(
        <span key={`token-${i}`} ref={(el) => registerTokenSpan(i, el)}>
          {renderRun(text.slice(token.start, token.end), token.start, tokenColor)}
        </span>
      );
      cursor = token.end;
    });
    if (cursor < text.length) segments.push(...renderRun(text.slice(cursor), cursor));
    return segments;
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          updateFromElement(e.currentTarget);
        }}
        onMouseMove={handleMouseMoveWithSelection}
        onMouseLeave={scheduleHide}
        onScroll={syncOverlayScroll}
        onSelect={handleSelect}
        onMouseUp={handleSelect}
        onKeyUp={handleSelect}
        onBlur={clearOnBlur}
        placeholder={placeholder}
        aria-invalid={ariaInvalid}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className={cn(
          // Native selection hidden (not disabled) — the overlay draws its own.
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-transparent caret-foreground transition-colors outline-none selection:bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring-glow aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className
        )}
      />
      <div
        ref={overlayRef}
        aria-hidden
        className={cn(
          // select-none: otherwise a document-wide selection can drag across overlays.
          "pointer-events-none absolute inset-0 overflow-hidden rounded-lg border border-transparent px-2.5 py-1 text-sm whitespace-pre select-none",
          className,
          // Must stay transparent, or it hides the input's caret.
          "bg-transparent"
        )}
      >
        {renderOverlaySegments(value, tokens)}
      </div>

      {hover && (
        <VariableHoverPopup
          hover={hover}
          environment={environment}
          variableContext={variableContext}
          onUpdateVariable={onUpdateVariable}
          onCreateVariable={onCreateVariable}
          onOpenEnvironment={onOpenEnvironment}
          onOpenVariablesPanel={onOpenVariablesPanel}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        />
      )}
    </div>
  );
}
