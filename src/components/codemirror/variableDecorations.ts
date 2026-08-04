import { Prec, RangeSetBuilder, type Extension } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { resolveVariable, tokenizeVariables } from "@/lib/variables";
import { setVariableAwareConfig, variableAwareConfigField } from "@/components/codemirror/variableAwareConfig";

// Colors each {{token}} resolved (blue) or unresolved/circular (red) —
// same rule VariableAwareTextarea's old manual overlay used. `start`/`end`
// from tokenizeVariables are already plain string indices, so they drop
// straight into a decoration range with no translation.
//
// A token almost always sits inside a JSON string value (e.g.
// `"url": "{{host}}"`), which the javascript() language mode also colors.
// CodeMirror nested our (narrower) mark as the *outer* span around the
// language highlighter's (wider) string span, not the inner one — so the
// string span's own color, being set directly on that descendant element,
// simply isn't reachable by anything set on the ancestor, `!important`
// included (a descendant's own declared value always wins over an
// ancestor's, regardless of specificity). What actually fixes it is
// `Prec.highest` below, which raises this plugin's decorations to the top
// precedence CodeMirror uses when combining multiple decoration sources —
// same mechanism @codemirror/search uses so its match-highlighting shows up
// over syntax-highlighted code.
function buildDecorations(view: EditorView): DecorationSet {
  const { variableContext } = view.state.field(variableAwareConfigField);
  const builder = new RangeSetBuilder<Decoration>();
  for (const token of tokenizeVariables(view.state.doc.toString())) {
    const resolution = resolveVariable(token.name, variableContext);
    const color = resolution.kind === "resolved" ? "var(--color-variable-resolved)" : "var(--color-destructive)";
    // Both belt (Prec.highest above) and suspenders (!important here): the
    // precedence bump is what actually fixed the nesting-order case, but
    // !important is kept too as a cheap guard against the flat-merged-span
    // case where two decorations land on the very same element.
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
