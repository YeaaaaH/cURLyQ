export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export const METHOD_COLORS: Record<string, string> = {
  GET: "text-method-get",
  POST: "text-method-post",
  PUT: "text-method-put",
  PATCH: "text-method-patch",
  DELETE: "text-method-delete",
};

// reqwest sends no User-Agent by default, and some hosts (e.g. httpbingo.org)
// reject UA-less requests with a bare 402.
export const DEFAULT_HEADERS: { key: string; value: string }[] = [
  { key: "User-Agent", value: "cURLyQ/0.1.0" },
];

export interface HttpResponse {
  status: number;
  // Tuples, not a Record, so repeated headers (Set-Cookie) survive.
  headers: [string, string][];
  body: string;
  timeMs: number;
  sizeBytes: number;
}
