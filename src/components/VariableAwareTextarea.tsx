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

// Multi-line counterpart to VariableAwareInput (see its comment for the
// overlay technique itself) — kept as its own component rather than one
// polymorphic single/multi-line component, since wrapping behavior between
// a <textarea> and its overlay needs different CSS (`white-space: pre-wrap`
// + wrapping vs. single-line `pre`) and scroll-sync needs both axes here,
// not just horizontal.
export function VariableAwareTextarea({
  value,
  onChange,
  environment,
  variableContext,
  onUpdateVariable,
  onOpenEnvironment,
  onOpenVariablesPanel,
  onKeyDown,
  placeholder,
  ariaInvalid,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  environment: Environment | null;
  variableContext: VariableLookup;
  onUpdateVariable: (name: string, value: string) => void;
  onOpenEnvironment: () => void;
  onOpenVariablesPanel: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  ariaInvalid?: boolean;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const { tokens, hover, handleMouseMove, scheduleHide, cancelHide, registerTokenSpan } = useVariableTokenHover(value);
  const { selection, updateFromElement, clearOnBlur } = useTextSelection();
  const clampedSelection = clampSelection(selection, value.length);

  // Deferred rather than reading e.currentTarget synchronously — see
  // VariableAwareInput's handleSelect for why: the browser may not have
  // finalized a click's new (collapsed) selection by the exact point
  // mouseup/select/keyup fire, so reading it synchronously can observe the
  // stale prior range and re-affirm it instead of clearing it.
  function handleSelect() {
    requestAnimationFrame(() => {
      if (textareaRef.current) updateFromElement(textareaRef.current);
    });
  }

  // A drag-select doesn't reliably fire a live "select" event as it
  // extends (at least not in this webview) — see VariableAwareInput's
  // version of this for the full reasoning. Reading selectionStart/
  // selectionEnd on every mousemove while a button is held gives live
  // feedback without the cost of the hover hit-testing this replaces it
  // with while dragging.
  function handleMouseMoveWithSelection(e: React.MouseEvent<HTMLTextAreaElement>) {
    if (e.buttons !== 0) updateFromElement(e.currentTarget);
    handleMouseMove(e);
  }

  // Same lockstep-scroll idea as VariableAwareInput, but both axes — a
  // multi-line body scrolls vertically far more often than horizontally.
  useLayoutEffect(() => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  });

  function syncOverlayScroll(e: React.UIEvent<HTMLTextAreaElement>) {
    if (overlayRef.current) {
      overlayRef.current.scrollTop = e.currentTarget.scrollTop;
      overlayRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  }

  // See VariableAwareInput's renderRun/renderOverlaySegments — identical
  // approach, manually splitting each run against the current selection
  // (see useTextSelection.ts) rather than relying on native ::selection.
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
      const tokenColor = resolution.kind === "resolved" ? "var(--color-variable-resolved)" : "var(--color-destructive)";
      segments.push(
        <span key={`token-${i}`} ref={(el) => registerTokenSpan(i, el)}>
          {renderRun(text.slice(token.start, token.end), token.start, tokenColor)}
        </span>
      );
      cursor = token.end;
    });
    if (cursor < text.length) segments.push(...renderRun(text.slice(cursor), cursor));
    // A trailing newline needs an extra zero-width marker so the wrapped
    // overlay reserves a blank final line the same way a real <textarea>
    // does — a `pre-wrap` block otherwise collapses a wholly-empty last
    // line, which would make the overlay one line shorter than the real
    // text and drift out of alignment.
    if (text.endsWith("\n")) segments.push("​");
    return segments;
  }

  return (
    <div className="relative min-h-0 w-full flex-1">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          updateFromElement(e.currentTarget);
        }}
        onMouseMove={handleMouseMoveWithSelection}
        onMouseLeave={scheduleHide}
        onScroll={syncOverlayScroll}
        onKeyDown={onKeyDown}
        onSelect={handleSelect}
        onMouseUp={handleSelect}
        onKeyUp={handleSelect}
        onBlur={clearOnBlur}
        onMouseDown={(e) => {
          if (e.detail < 3) return;
          e.preventDefault();
          const el = e.currentTarget;
          el.select();
          // .select() isn't guaranteed to fire a native "select" event in
          // every browser — update our own state explicitly rather than
          // assume it does, so the highlight actually appears.
          updateFromElement(el);
        }}
        placeholder={placeholder}
        aria-invalid={ariaInvalid}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className={cn(
          // The overlay draws its own selection highlight (see
          // useTextSelection.ts) — the real textarea's native one is hidden
          // (not disabled: selection/copy/keyboard-extend still work) so it
          // doesn't also paint a second, uncoordinated band underneath.
          "scrollbar-thin absolute inset-0 h-full w-full resize-none overflow-y-auto text-transparent caret-foreground outline-none selection:bg-transparent placeholder:text-muted-foreground/70 aria-invalid:ring-2 aria-invalid:ring-destructive",
          className
        )}
      />
      <div
        ref={overlayRef}
        aria-hidden
        className={cn(
          // select-none — see VariableAwareInput's overlay for why: without
          // it, this real (visible) DOM text can be picked up by the
          // browser's own document-wide selection independent of the real
          // textarea's own selectionStart/selectionEnd.
          "pointer-events-none absolute inset-0 h-full w-full overflow-hidden text-foreground whitespace-pre-wrap break-words select-none",
          className,
          // Always wins the tailwind-merge conflict below, no matter what
          // background utility `className` carries — see VariableAwareInput
          // for why the overlay must stay transparent (it's stacked
          // directly on top of the real textarea and would otherwise hide
          // its native blinking caret).
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
          onOpenEnvironment={onOpenEnvironment}
          onOpenVariablesPanel={onOpenVariablesPanel}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        />
      )}
    </div>
  );
}
