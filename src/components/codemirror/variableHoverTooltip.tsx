import { hoverTooltip, type Tooltip } from "@codemirror/view";
import { createRoot } from "react-dom/client";
import { tokenizeVariables } from "@/lib/variables";
import { variableAwareConfigField } from "@/components/codemirror/variableAwareConfig";
import { VariableHoverPopupContent } from "@/components/variable-aware/VariableHoverPopup";

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
        // Reassigned on update() so edits made in the popup read the latest config.
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
