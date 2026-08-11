import type { KeyValuePair } from "@/lib/keyValue";

export function buildRequestUrl(rawUrl: string, params: KeyValuePair[]): string {
  const url = new URL(rawUrl);
  url.search = "";
  for (const { key, value, enabled } of params) {
    if (!enabled || key.trim() === "") continue;
    url.searchParams.append(key, value);
  }
  return url.toString();
}

// Only escapes characters that would otherwise break the query string's
// structure (&, =, #) — everything else, including non-ASCII text, is left
// readable. url.toString() would percent-encode all of it, which is correct
// for the wire format but unreadable while editing.
export function escapeForDisplay(value: string): string {
  return value.replace(/[&=#]/g, (ch) => encodeURIComponent(ch));
}

// Plain string splicing rather than the URL API, so this also works for
// template URLs like {{baseUrl}}/path that aren't parseable as absolute URLs.
export function buildDisplayUrl(rawUrl: string, params: KeyValuePair[]): string {
  const hashIndex = rawUrl.indexOf("#");
  const hash = hashIndex === -1 ? "" : rawUrl.slice(hashIndex);
  const withoutHash = hashIndex === -1 ? rawUrl : rawUrl.slice(0, hashIndex);
  const queryIndex = withoutHash.indexOf("?");
  const base = queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);
  const query = params
    .filter(({ key, enabled }) => enabled && key.trim() !== "")
    .map(({ key, value }) => `${escapeForDisplay(key)}=${escapeForDisplay(value)}`)
    .join("&");
  return `${base}${query ? `?${query}` : ""}${hash}`;
}

export function syncUrlWithParams(rawUrl: string, params: KeyValuePair[]): string {
  return buildDisplayUrl(rawUrl, params);
}

// Postman's own request-detail UI (address bar, Params tab, and apparently
// whatever else shares that render path) is driven by the url object's
// parsed `host`/`path`/`query`, not `raw` — `raw` is redundant/duplicate
// info Postman keeps in sync with those, not a fallback source of truth. An
// exported `{ raw }`-only url object renders as blank in real Postman even
// though the text is right there. String splicing rather than the URL API,
// same reasoning as buildDisplayUrl: `{{baseUrl}}/path` isn't a parseable
// absolute URL, but still needs a host/path split.
export function buildPostmanUrlObject(
  rawUrl: string,
  params: KeyValuePair[]
): { raw: string; protocol?: string; host?: string[]; path?: string[]; query?: unknown[] } {
  const hashIndex = rawUrl.indexOf("#");
  const withoutHash = hashIndex === -1 ? rawUrl : rawUrl.slice(0, hashIndex);
  const queryIndex = withoutHash.indexOf("?");
  const base = queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);

  const protocolMatch = base.match(/^([a-zA-Z][a-zA-Z\d+\-.]*):\/\//);
  const protocol = protocolMatch ? protocolMatch[1] : undefined;
  const afterProtocol = protocolMatch ? base.slice(protocolMatch[0].length) : base;

  const slashIndex = afterProtocol.indexOf("/");
  const hostPart = slashIndex === -1 ? afterProtocol : afterProtocol.slice(0, slashIndex);
  const pathPart = slashIndex === -1 ? "" : afterProtocol.slice(slashIndex + 1);

  // A bare `{{baseUrl}}` host has no literal dots, so splitting on "." still
  // yields the single-element array Postman's own exports use for a
  // variable-only host — this doesn't need a special case.
  const host = hostPart === "" ? [] : hostPart.split(".");
  const path = pathPart === "" ? [] : pathPart.split("/").filter((segment) => segment !== "");
  const query = params
    .filter((p) => p.key.trim() !== "")
    .map((p) => ({ key: p.key, value: p.value, ...(p.enabled ? {} : { disabled: true }) }));

  return {
    raw: rawUrl,
    ...(protocol ? { protocol } : {}),
    ...(host.length > 0 ? { host } : {}),
    ...(path.length > 0 ? { path } : {}),
    ...(query.length > 0 ? { query } : {}),
  };
}

export function unescapeFromDisplay(value: string): string {
  return value.replace(/%23|%26|%3d/gi, (seq) => decodeURIComponent(seq));
}

// Reverse of buildDisplayUrl — also plain string splicing rather than the URL
// API, so typing/pasting a template URL like {{baseUrl}}/path?x=1 (which
// isn't parseable as an absolute URL) still keeps the Params tab in sync.
export function parseParamsFromUrl(rawUrl: string): KeyValuePair[] {
  const hashIndex = rawUrl.indexOf("#");
  const withoutHash = hashIndex === -1 ? rawUrl : rawUrl.slice(0, hashIndex);
  const queryIndex = withoutHash.indexOf("?");
  if (queryIndex === -1) return [];
  const query = withoutHash.slice(queryIndex + 1);
  if (query === "") return [];
  return query
    .split("&")
    .map((pair) => {
      const eqIndex = pair.indexOf("=");
      const key = eqIndex === -1 ? pair : pair.slice(0, eqIndex);
      const value = eqIndex === -1 ? "" : pair.slice(eqIndex + 1);
      return {
        id: crypto.randomUUID(),
        key: unescapeFromDisplay(key),
        value: unescapeFromDisplay(value),
        enabled: true,
      };
    })
    .filter(({ key, value }) => key !== "" || value !== "");
}
