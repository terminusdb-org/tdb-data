// Recognized API error payloads the UI handles locally. These must not
// surface in the global error banner — each call site renders guidance
// instead. Anything not listed here stays an error.

// RTK Query puts the payload in error.data; endpoints using a text
// responseHandler leave it as a JSON string, so parse before inspecting.
function errorData(error: unknown): Record<string, unknown> | null {
  if (!error || typeof error !== "object" || !("data" in error)) return null;
  let data: unknown = (error as { data: unknown }).data;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (typeof data !== "object" || data === null) return null;
  return data as Record<string, unknown>;
}

// The api:error sub-object carries the specific @type; fall back to the
// envelope @type for payloads that lack one.
export function apiErrorType(error: unknown): string | null {
  const data = errorData(error);
  if (!data) return null;
  const apiError = data["api:error"];
  const type =
    typeof apiError === "object" && apiError !== null
      ? (apiError as Record<string, unknown>)["@type"]
      : data["@type"];
  return typeof type === "string" ? type : null;
}

// Type has no embedding metadata — the embeddings UI can configure it.
export function isNoEmbeddingQueriesError(error: unknown): boolean {
  return apiErrorType(error) === "api:NoEmbeddingQueriesDefined";
}

// No vectorlink / semantic-indexer backend is configured — index status
// and embedding queries degrade to "not configured" states.
const ENDPOINT_NOT_CONFIGURED_TYPES = new Set([
  "api:EndpointNotConfigured",
  "api:VectorlinkEndpointNotConfigured",
  "api:SemanticIndexerEndpointNotConfigured",
]);

export function isEndpointNotConfiguredError(error: unknown): boolean {
  const type = apiErrorType(error);
  return type !== null && ENDPOINT_NOT_CONFIGURED_TYPES.has(type);
}

// Whitelist for the global banner: everything the app already renders as
// guidance rather than a failure.
export function isAcceptedApiError(error: unknown): boolean {
  return isNoEmbeddingQueriesError(error) || isEndpointNotConfiguredError(error);
}
