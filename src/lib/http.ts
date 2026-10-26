import { version } from "../../package.json";

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

export const METHOD_COLORS: Record<string, string> = {
  GET: "text-method-get",
  POST: "text-method-post",
  PUT: "text-method-put",
  PATCH: "text-method-patch",
  DELETE: "text-method-delete",
  HEAD: "text-method-head",
  OPTIONS: "text-method-options",
};

const SHORT_METHOD_LABELS: Record<string, string> = { OPTIONS: "OPT" };

export function shortMethodLabel(method: string): string {
  return SHORT_METHOD_LABELS[method] ?? method;
}

// reqwest sends no User-Agent by default, and some hosts (e.g. httpbingo.org)
// reject UA-less requests with a bare 402.
export const DEFAULT_HEADERS: { key: string; value: string }[] = [
  { key: "User-Agent", value: `cURLyQ/${version}` },
];

export interface HttpResponse {
  status: number;
  // Tuples, not a Record, so repeated headers (Set-Cookie) survive.
  headers: [string, string][];
  body: string;
  timeMs: number;
  sizeBytes: number;
  isBinary: boolean;
}
