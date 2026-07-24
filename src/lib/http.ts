export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export const METHOD_COLORS: Record<string, string> = {
  GET: "text-green-600",
  POST: "text-amber-600",
  PUT: "text-blue-600",
  PATCH: "text-purple-600",
  DELETE: "text-destructive",
};

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}
