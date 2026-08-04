import { javascript } from "@codemirror/lang-javascript";
import { baseExtensions } from "@/components/codemirror/theme";
import { useCodeMirrorEditor } from "@/components/codemirror/useCodeMirrorEditor";

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function ScriptEditor({ value, onChange, placeholder }: ScriptEditorProps) {
  // Only read on mount — see useCodeMirrorEditor's comment on why the
  // extensions array isn't reactive to re-renders.
  const { containerRef } = useCodeMirrorEditor({
    value,
    onChange,
    extensions: [javascript(), ...baseExtensions(placeholder)],
  });

  return (
    <div
      ref={containerRef}
      className="scrollbar-thin h-full min-h-24 w-full flex-1 overflow-y-auto rounded-md border border-input bg-background p-2"
    />
  );
}
