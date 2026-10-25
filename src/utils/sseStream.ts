/**
 * Parse a Server-Sent Events (SSE) stream into an async generator of
 * parsed JSON data events.
 *
 * SSE event format (per the SSE spec and the graphql-sse protocol used by
 * TerminusDB GraphQL subscriptions):
 *   - Events are separated by a blank line (`\n\n`)
 *   - Comment blocks start with `:` (keepalives) — skipped
 *   - Event blocks may contain multiple lines:
 *       `event: next`   — the event type (graphql-sse protocol)
 *       `data: {json}`  — the JSON payload (with or without trailing space)
 *   - Only blocks containing a `data:` line yield a parsed event
 *
 * The generator continues yielding events until the stream ends (server
 * closes the connection) or the consumer early-terminates the generator
 * (via `for...of` break, `gen.return()`, or dropping the reference). On
 * termination, the reader is cancelled and the optional AbortController
 * is aborted, ensuring the underlying HTTP connection is closed.
 *
 * @param body   The ReadableStream from a fetch Response.
 */
export async function* parseSSEStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      // Keep the last (possibly partial) chunk in the buffer.
      buffer = events.pop() ?? "";
      for (const eventBlock of events) {
        const block = eventBlock.trimStart();
        if (block.startsWith(":")) continue;
        // Parse multi-line SSE event block — extract the data: line.
        let dataLine: string | null = null;
        for (const line of block.split("\n")) {
          if (line.startsWith("data: ")) {
            dataLine = line.slice(6);
          } else if (line.startsWith("data:")) {
            dataLine = line.slice(5);
          }
        }
        if (dataLine !== null) {
          try {
            yield JSON.parse(dataLine);
          } catch {
            // Skip malformed JSON data lines.
          }
        }
      }
    }
  } finally {
    try {
      reader.cancel();
    } catch {
      // Already closed.
    }
  }
}
