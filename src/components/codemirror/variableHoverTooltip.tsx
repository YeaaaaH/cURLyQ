import { hoverTooltip, type Tooltip } from "@codemirror/view";
import { createRoot } from "react-dom/client";
import { tokenizeVariables } from "@/lib/variables";
import { variableAwareConfigField } from "@/components/codemirror/variableAwareConfig";
import { VariableHoverPopupContent } from "@/components/variable-aware/VariableHoverPopup";

// Replaces useVariableTokenHover.ts's manual span-rect hit-testing:
// CodeMirror already calls this with the document position under the
// pointer, so finding "which token (if any)" is a plain range check against
// tokenizeVariables' output instead of getBoundingClientRect() on every
// registered token span.
export function variableHoverTooltip() {
  return hoverTooltip((view, pos): Tooltip | null => {
    const token = tokenizeVariables(view.state.doc.toString()).find((t) => pos >= t.start && pos <= t.end);
    if (!token) return null;
    const tokenName = token.name;

    return {
      pos: token.start,
      end: token.end,
      create(initialView) {
        const dom = document.createElement("div");
        const root = createRoot(dom);
        // `currentView` is reassigned on each `update()` so a render
        // triggered by an in-popup edit (onUpdateVariable -> environment
        // change -> setVariableAwareConfig) reads the config current as of
        // that update, not the one captured when the tooltip first opened.
        let currentView = initialView;
        function render() {
          const config = currentView.state.field(variableAwareConfigField);
          root.render(<VariableHoverPopupContent name={tokenName} {...config} />);
        }
        render();
        return {
          dom,
          update(update) {
            currentView = update.view;
            render();
          },
          destroy() {
            root.unmount();
          },
        };
      },
    };
  });
}
