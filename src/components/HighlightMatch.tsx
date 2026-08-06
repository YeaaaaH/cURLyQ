function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface HighlightMatchProps {
  text: string;
  query: string;
}

// Wraps every case-insensitive occurrence of `query` within `text` in a
// <mark> so a search result visibly shows why it matched. Renders `text`
// unchanged when `query` is blank or doesn't occur in it.
export function HighlightMatch({ text, query }: HighlightMatchProps) {
  const trimmed = query.trim();
  if (trimmed === "") return <>{text}</>;

  const parts = text.split(new RegExp(`(${escapeRegExp(trimmed)})`, "gi"));
  if (parts.length === 1) return <>{text}</>;

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark key={i} className="rounded-sm bg-primary/30 text-inherit">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}
