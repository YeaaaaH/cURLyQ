export interface CommentToggleResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

// Toggles a `//` line comment across every line touched by the current
// selection (or just the cursor's line, if nothing is selected) — the same
// Ctrl+/ behavior most code editors provide. Comments if any touched
// non-blank line isn't already commented; only uncomments once every touched
// non-blank line already is, so pressing it twice in a row reverses itself.
// Indentation is preserved either way — the `//` marker is inserted/removed
// right after each line's existing leading whitespace, not at column 0.
export function toggleLineComment(value: string, selectionStart: number, selectionEnd: number): CommentToggleResult {
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  // A collapsed selection (selectionEnd === selectionStart) searches for the
  // newline starting at the cursor itself; a real selection searches from
  // one character before its end, so a selection ending exactly at the start
  // of the next line doesn't pull that (unselected) line into the block.
  const searchFrom = selectionEnd > selectionStart ? selectionEnd - 1 : selectionEnd;
  const nextNewline = value.indexOf("\n", searchFrom);
  const lineEnd = nextNewline === -1 ? value.length : nextNewline;

  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");
  const nonBlankLines = lines.filter((line) => line.trim() !== "");
  const allCommented = nonBlankLines.length > 0 && nonBlankLines.every((line) => line.trimStart().startsWith("//"));

  const nextLines = lines.map((line) => {
    if (line.trim() === "") return line;
    return allCommented ? line.replace(/^(\s*)\/\/ ?/, "$1") : line.replace(/^(\s*)/, "$1// ");
  });

  const nextBlock = nextLines.join("\n");
  return {
    value: value.slice(0, lineStart) + nextBlock + value.slice(lineEnd),
    selectionStart: lineStart,
    selectionEnd: lineStart + nextBlock.length,
  };
}
