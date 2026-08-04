import { javascript } from "@codemirror/lang-javascript";
import { Button } from "@/components/ui/button";
import { baseExtensions } from "@/components/codemirror/theme";
import { useCodeMirrorEditor } from "@/components/codemirror/useCodeMirrorEditor";

export interface ScriptSnippet {
  label: string;
  insert: string;
}

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  snippets: ScriptSnippet[];
}

export function ScriptEditor({ value, onChange, placeholder, snippets }: ScriptEditorProps) {
  // Only read on mount — see useCodeMirrorEditor's comment on why the
  // extensions array isn't reactive to re-renders.
  const { containerRef, viewRef } = useCodeMirrorEditor({
    value,
    onChange,
    extensions: [javascript(), ...baseExtensions(placeholder)],
  });

  // Replaces the current selection (an empty one, most of the time — just
  // the cursor) with the snippet text, then leaves the cursor right after
  // it, same as typing it would.
  function insertSnippet(text: string) {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
    view.focus();
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      <div className="flex shrink-0 flex-wrap gap-1.5">
        {snippets.map((snippet) => (
          <Button
            key={snippet.label}
            type="button"
            variant="outline"
            size="xs"
            className="font-mono"
            onClick={() => insertSnippet(snippet.insert)}
          >
            {snippet.label}
          </Button>
        ))}
      </div>
      <div
        ref={containerRef}
        className="scrollbar-thin min-h-24 w-full flex-1 overflow-y-auto rounded-md border border-input bg-background p-2"
      />
    </div>
  );
}
