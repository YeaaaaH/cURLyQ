import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

function formatBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function statusVariant(status: number): "default" | "secondary" | "destructive" {
  if (status < 300) return "default";
  if (status < 400) return "secondary";
  return "destructive";
}

function getUrlError(url: string): string | null {
  const trimmed = url.trim();
  if (trimmed === "") return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "Enter a full URL, e.g. https://example.com";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "URL must start with http:// or https://";
  }
  return null;
}

function App() {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [response, setResponse] = useState<HttpResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const isUrlEmpty = url.trim() === "";
  const urlError = getUrlError(url);
  const canSend = !isUrlEmpty && !urlError;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setError(null);
    setResponse(null);
    setIsSending(true);
    try {
      const result = await invoke<HttpResponse>("send_request", { method, url });
      setResponse(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 p-8">
      <form className="flex flex-col gap-1.5" onSubmit={handleSend}>
        <div className="flex gap-2">
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="w-28 font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HTTP_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="font-mono aria-invalid:border-destructive"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            aria-invalid={urlError !== null}
          />
          <Button type="submit" disabled={isSending || !canSend}>
            {isSending ? "Sending…" : "Send"}
          </Button>
        </div>
        {urlError && <p className="text-sm text-destructive">{urlError}</p>}
      </form>

      {error && (
        <Card className="border-destructive">
          <CardContent>
            <p className="mb-2 font-semibold text-destructive">Error</p>
            <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap break-words font-mono text-sm text-destructive">
              {error}
            </pre>
          </CardContent>
        </Card>
      )}

      {response && (
        <Card className="gap-0 py-0">
          <div className="flex items-center border-b px-4 py-3">
            <Badge variant={statusVariant(response.status)} className="font-mono text-sm">
              {response.status}
            </Badge>
          </div>

          {Object.keys(response.headers).length > 0 && (
            <Collapsible className="border-b">
              <CollapsibleTrigger className="group flex w-full items-center justify-between px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                Headers ({Object.keys(response.headers).length})
                <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="max-h-[200px] overflow-auto px-4 pb-2 font-mono text-sm">
                {Object.entries(response.headers).map(([name, value]) => (
                  <div className="flex gap-2 py-0.5" key={name}>
                    <span className="text-muted-foreground">{name}</span>
                    <span className="break-all">{value}</span>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-sm">
            {formatBody(response.body)}
          </pre>
        </Card>
      )}
    </main>
  );
}

export default App;
