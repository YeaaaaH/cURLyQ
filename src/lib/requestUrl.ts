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

// Escapes only &, =, # — url.toString() would percent-encode everything,
// which is unreadable while editing.
export function escapeForDisplay(value: string): string {
  return value.replace(/[&=#]/g, (ch) => encodeURIComponent(ch));
}

// String splicing, not the URL API: {{baseUrl}}/path isn't a parseable URL.
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

// Postman renders from the parsed host/path/query, not `raw` — a raw-only
// url object shows up blank there.
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
