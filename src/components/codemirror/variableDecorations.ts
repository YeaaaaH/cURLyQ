import { Prec, RangeSetBuilder, type Extension } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { resolveVariable, tokenizeVariables } from "@/lib/variables";
import { setVariableAwareConfig, variableAwareConfigField } from "@/components/codemirror/variableAwareConfig";

// Prec.highest: otherwise our mark nests outside the syntax highlighter's string
// span, whose own color wins even over !important.
function buildDecorations(view: EditorView): DecorationSet {
  const { variableContext } = view.state.field(variableAwareConfigField);
  const builder = new RangeSetBuilder<Decoration>();
  for (const token of tokenizeVariables(view.state.doc.toString())) {
    const resolution = resolveVariable(token.name, variableContext);
    const color =
      resolution.kind === "resolved"
        ? "var(--color-variable-resolved)"
        : resolution.kind === "circular"
          ? "var(--color-variable-circular)"
          : "var(--color-destructive)";
    // !important too, for when two decorations merge onto one span.
    builder.add(token.start, token.end, Decoration.mark({ attributes: { style: `color: ${color} !important` } }));
  }
  return builder.finish();
}

const variableDecorationsPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      const configChanged = update.transactions.some((tr) => tr.effects.some((e) => e.is(setVariableAwareConfig)));
      if (update.docChanged || configChanged) this.decorations = buildDecorations(update.view);
    }
  },
  { decorations: (plugin) => plugin.decorations }
);

export function variableDecorations(): Extension {
  return [variableAwareConfigField, Prec.highest(variableDecorationsPlugin)];
}
