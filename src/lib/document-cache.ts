/** HTML contains version-specific module references and must not survive an update. */
export function preventDocumentCaching(response: Response): Response {
  if (!response.headers.get("content-type")?.includes("text/html")) return response;
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store, max-age=0");
  headers.delete("last-modified");
  headers.delete("etag");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}