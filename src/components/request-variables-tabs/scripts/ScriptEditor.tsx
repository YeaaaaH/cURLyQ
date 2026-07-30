import { toggleLineComment } from "@/lib/textEditing";

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function ScriptEditor({ value, onChange, placeholder }: ScriptEditorProps) {
  // Ctrl+/ (Cmd+/ on Mac) toggles a `//` comment on the selected lines, same
  // as most code editors — scripts are plain JS, so this is unambiguous here.
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "/" || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const textarea = e.currentTarget;
    const next = toggleLineComment(textarea.value, textarea.selectionStart, textarea.selectionEnd);
    onChange(next.value);
    // Controlled textareas don't preserve cursor position on programmatic
    // value changes, so restore it manually once React commits the new value.
    requestAnimationFrame(() => textarea.setSelectionRange(next.selectionStart, next.selectionEnd));
  }

  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      spellCheck={false}
      autoComplete="off"
      autoCorrect="off"
      className="scrollbar-thin h-full min-h-24 w-full flex-1 resize-none rounded-md border border-input bg-background p-2 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
    />
  );
}
