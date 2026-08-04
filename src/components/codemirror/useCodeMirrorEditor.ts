import { useEffect, useRef } from "react";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

// CodeMirror is an *imperative* library — an EditorView owns its own
// internal document/selection state, it doesn't re-render from React props
// the way a <textarea value={...}> would. This hook is what bridges the two
// worlds: it mounts one EditorView on `containerRef` and keeps it in sync
// with a normal controlled `value`/`onChange` pair, the same shape every
// other input in this app already uses.
//
// `extensions` is only read on mount — CodeMirror extensions describe
// *fixed* editor behavior (language, keymap, theme), not per-render props,
// so there's no need to reconfigure the view when a caller's extensions
// array is a new identity each render. Anything that genuinely changes over
// an editor's lifetime (e.g. Body's variable-resolution context, added in a
// later change) is threaded in via a CodeMirror StateEffect dispatched
// through `viewRef`, not by recreating extensions.
export function useCodeMirrorEditor({
  value,
  onChange,
  extensions,
}: {
  value: string;
  onChange: (value: string) => void;
  extensions: Extension[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Kept in a ref so the mount effect below doesn't need `onChange` in its
  // dependency array — this app's callbacks (e.g. useRequestTabs' updaters)
  // are recreated most renders, and reacting to that would tear down and
  // rebuild the EditorView (losing undo history/scroll position) for no
  // reason.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;
    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          ...extensions,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
      parent: containerRef.current,
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Mount once; see the comment above the hook for why extensions aren't
    // a dependency here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconciles an externally-driven `value` change (e.g. switching request
  // tabs loads a different body) into the view. Guarded by an equality
  // check so this doesn't also fire — and fight the cursor — every time
  // `value` changes because of our *own* onChange echoing back through the
  // parent's state.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  return { containerRef, viewRef };
}
