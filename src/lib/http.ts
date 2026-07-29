export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export const METHOD_COLORS: Record<string, string> = {
  GET: "text-green-600",
  POST: "text-amber-600",
  PUT: "text-blue-600",
  PATCH: "text-purple-600",
  DELETE: "text-destructive",
};

// Sent automatically with every request unless the user's own headers
// already include the same key (case-insensitive) — see handleSend in
// App.tsx, which injects these right before sending, and the Headers editor,
// which shows whichever of these aren't overridden as locked, informational
// rows so it's clear something is being sent even though the user never
// typed it in. Browsers always send a User-Agent; reqwest (the Rust HTTP
// client) doesn't unless told to, and some hosts (e.g. httpbingo.org, on
// Fly.io) reject UA-less requests outright with a bare, unexplained 402.
export const DEFAULT_HEADERS: { key: string; value: string }[] = [
  { key: "User-Agent", value: "cURLyQ/0.1.0" },
];

export interface HttpResponse {
  status: number;
  // A tuple array (not Record<string, string>) so repeated header names —
  // e.g. multiple Set-Cookie values — survive instead of the later one
  // silently overwriting the earlier ones.
  headers: [string, string][];
  body: string;
}
