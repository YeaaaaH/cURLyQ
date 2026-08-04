import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab, toggleComment } from "@codemirror/commands";
import { bracketMatching, HighlightStyle, indentUnit, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView, keymap, placeholder as placeholderExtension } from "@codemirror/view";
import { tags } from "@lezer/highlight";

// Colors reference the app's existing CSS custom properties (src/index.css)
// instead of hardcoding hex values, so the editor tracks the current
// light/dark theme (toggled via the `.dark` class — see ThemeProvider.tsx)
// automatically, the same way VariableAwareTextarea's old overlay did for
// its resolved/unresolved token colors.
const highlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: "var(--color-muted-foreground)", fontStyle: "italic" },
  { tag: tags.string, color: "var(--color-success)" },
  { tag: tags.number, color: "var(--color-variable-resolved)" },
  { tag: [tags.bool, tags.null, tags.atom], color: "var(--color-method-patch)" },
  { tag: [tags.keyword, tags.controlKeyword, tags.operatorKeyword], color: "var(--color-primary)" },
  { tag: tags.propertyName, color: "var(--color-foreground)" },
  { tag: tags.invalid, color: "var(--color-destructive)" },
]);

// Visual chrome (font, sizing, scrollbar) lives here rather than on the
// wrapping container div — CodeMirror renders its own internal DOM
// (.cm-editor/.cm-scroller/.cm-content), so the parts that need to look
// like the rest of the app's text areas have to target CM's own class
// names via EditorView.theme rather than a plain className prop.
export const cmTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "var(--text-sm)",
    color: "var(--color-foreground)",
    backgroundColor: "transparent",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-content": {
    fontFamily: "var(--font-mono)",
    caretColor: "var(--color-foreground)",
  },
  ".cm-cursor": { borderLeftColor: "var(--color-foreground)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--color-ring) !important",
  },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-gutters": { display: "none" },
  ".cm-scroller": { overflow: "auto", scrollbarWidth: "thin", scrollbarColor: "var(--color-border) transparent" },
  ".cm-scroller::-webkit-scrollbar": { width: "6px", height: "6px" },
  ".cm-scroller::-webkit-scrollbar-track": { background: "transparent" },
  ".cm-scroller::-webkit-scrollbar-thumb": { backgroundColor: "var(--color-border)", borderRadius: "9999px" },
  ".cm-placeholder": { color: "var(--color-muted-foreground)", opacity: 0.7 },
});

// Shared behavior for both the Body and Script editors: 2-space indent,
// undo/redo history, bracket auto-close/match, and a keymap that mirrors
// what the old hand-rolled textareas supported (Tab to indent, Ctrl/Cmd-/
// to toggle a line comment) — but via CodeMirror's own built-in commands
// instead of the custom regex-based toggleLineComment (src/lib/textEditing.ts).
export function baseExtensions(placeholder?: string): Extension[] {
  return [
    cmTheme,
    syntaxHighlighting(highlightStyle),
    indentUnit.of("  "),
    history(),
    bracketMatching(),
    closeBrackets(),
    keymap.of([
      { key: "Mod-/", run: toggleComment },
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      indentWithTab,
    ]),
    ...(placeholder !== undefined ? [placeholderExtension(placeholder)] : []),
  ];
}
