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

// A native <input> can't style only part of its own text, so {{var}} tokens
// can't be colored by rendering into the input alone. Instead the real
// input's own text is made invisible (`text-transparent`, with an explicit
// `caret-foreground` so the blinking caret still shows), and a non-
// interactive (`pointer-events-none`) sibling <div> is stacked exactly on
// top of it, rendering the same text as plain runs plus a colored <span>
// per {{var}} token — scrolled in lockstep with the input. The input still
// owns all editing (cursor, selection, undo, IME) natively; the overlay is
// purely visual and never receives focus or edits.
//
// An earlier version instead made a contentEditable div itself the editable
// element, with real colored spans per token — that proved fragile: keeping
// it in sync with a `value` that can also change from *outside* the field
// (e.g. editing a Param rewrites the URL) meant a stale saved cursor offset
// could get restored into freshly-rendered content that didn't match what
// was actually typed, corrupting the text. This overlay approach doesn't
// have that risk, since the real input is always the single source of
// truth for what's actually being edited.
export function VariableAwareInput({
  value,
  onChange,
  environment,
  variableContext,
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
  variableContext: VariableLookup;
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
  const overlayRef = useRef<HTMLDivElement>(null);
  const { tokens, hover, handleMouseMove, scheduleHide, cancelHide, registerTokenSpan } = useVariableTokenHover(value);
  const { selection, updateFromElement, clearOnBlur } = useTextSelection();
  const clampedSelection = clampSelection(selection, value.length);

  // Deferred rather than reading e.currentTarget synchronously: on a plain
  // click that collapses a previous selection (e.g. right after a
  // triple-click that selected everything), the browser hasn't necessarily
  // finalized the new (collapsed) selectionStart/selectionEnd yet by the
  // exact point mouseup/select/keyup fire — reading it synchronously here
  // could still observe the *old* range and re-affirm it instead of
  // clearing it, leaving a stale highlight visible after a click that
  // should have removed it. Reading one frame later, from the ref rather
  // than the event's target, reads the settled value instead.
  function handleSelect() {
    requestAnimationFrame(() => {
      if (inputRef.current) updateFromElement(inputRef.current);
    });
  }

  // A drag-select doesn't reliably fire a live "select" event as it
  // extends (at least not in this webview) — only handleSelect's
  // mouseup/keyup/select handlers would otherwise catch it, so the
  // highlight only appeared once the drag ended instead of growing live
  // with it. Reading selectionStart/selectionEnd (cheap property reads,
  // unlike getBoundingClientRect) on every mousemove *while a button is
  // held* — exactly when the hover hit-testing below already skips its own
  // work — gives live feedback without reintroducing that cost.
  function handleMouseMoveWithSelection(e: React.MouseEvent<HTMLInputElement>) {
    if (e.buttons !== 0) updateFromElement(e.currentTarget);
    handleMouseMove(e);
  }

  // Keeps the overlay's horizontal scroll matched to the input's on every
  // render (e.g. typing past the visible edge auto-scrolls the input) — the
  // `onScroll` handler below covers cases that don't cause a re-render at
  // all (e.g. pressing End to jump the caret without changing the value).
  useLayoutEffect(() => {
    if (inputRef.current && overlayRef.current) {
      overlayRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  });

  function syncOverlayScroll(e: React.UIEvent<HTMLInputElement>) {
    if (overlayRef.current) overlayRef.current.scrollLeft = e.currentTarget.scrollLeft;
  }

  // Splits `value` into the plain runs between tokens plus one colored
  // <span ref=...> per token, for the overlay to render — the exact same
  // text as the real input, just with each {{var}} individually styleable.
  // Any run overlapping the current selection is further split so its
  // selected portion renders with SELECTED_TEXT_STYLE instead of its usual
  // color — see useTextSelection.ts for why this is drawn manually rather
  // than left to the browser's native text selection.
  function renderRun(text: string, absStart: number, color?: string): React.ReactNode[] {
    // `absStart` is unique per run (runs never overlap), so pairing it with
    // the part's index within the run gives a key unique across the whole
    // segments array, not just within this one call.
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
          // The overlay draws its own selection highlight (see
          // useTextSelection.ts) — the real input's native one is hidden
          // (not disabled: selection/copy/keyboard-extend still work) so it
          // doesn't also paint a second, uncoordinated band underneath.
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-transparent caret-foreground transition-colors outline-none selection:bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring-glow aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className
        )}
      />
      <div
        ref={overlayRef}
        aria-hidden
        className={cn(
          // select-none: this is a purely visual mirror of the real input's
          // text — without it, the browser's own document-wide text
          // selection can pick up this (real, visible) DOM text and drag a
          // selection across it into a *different* field's overlay,
          // independent of and inconsistent with the real input's own
          // selectionStart/selectionEnd that drives the highlighting above.
          "pointer-events-none absolute inset-0 overflow-hidden rounded-lg border border-transparent px-2.5 py-1 text-sm whitespace-pre select-none",
          className,
          // Always wins the tailwind-merge conflict below, no matter what
          // background utility `className` carries (e.g. KeyValueEditor's
          // `bg-card`): the overlay must stay transparent since it's
          // stacked directly on top of the real input, or it paints over
          // and hides that input's native blinking caret.
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
