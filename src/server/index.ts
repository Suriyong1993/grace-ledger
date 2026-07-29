/**
 * Grace Ledger v2 — Server Entry Point
 *
 * A minimal Node.js HTTP server that bridges IncomingMessage/ServerResponse
 * to the existing Fetch API route handlers (Request/Response).
 *
 * This is intentionally dependency-free — it uses only Node.js stdlib.
 *
 * Usage:
 *   bun run src/server/index.ts          # Start server
 *   bun run --watch src/server/index.ts  # Dev mode with hot reload
 *
 * Environment variables:
 *   PORT          — HTTP port (default: 3001)
 *   HOST          — Bind address (default: 0.0.0.0)
 *   LOG_LEVEL     — Not used here; middleware uses Pino
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { handleApiRequest } from "./api/routes";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

/**
 * Read the full body from an IncomingMessage as a Buffer.
 */
function readBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

/**
 * Build a Fetch API Request from a Node.js IncomingMessage.
 */
async function toFetchRequest(nodeReq: IncomingMessage, body: Buffer): Promise<Request> {
  const host = nodeReq.headers.host ?? `localhost:${PORT}`;
  const protocol = (nodeReq.headers["x-forwarded-proto"] as string) ?? "http";
  const url = new URL(nodeReq.url ?? "/", `${protocol}://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeReq.headers)) {
    if (value) {
      headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
  }

  const method = nodeReq.method ?? "GET";
  const hasBody = method !== "GET" && method !== "HEAD";

  return new Request(url, {
    method,
    headers,
    body: hasBody ? new Uint8Array(body) : null,
  });
}

/**
 * Write a Fetch API Response back to a Node.js ServerResponse.
 */
async function fromFetchResponse(fetchRes: Response, nodeRes: ServerResponse): Promise<void> {
  nodeRes.statusCode = fetchRes.status;

  fetchRes.headers.forEach((value, key) => {
    nodeRes.setHeader(key, value);
  });

  const body = await fetchRes.arrayBuffer();
  nodeRes.end(Buffer.from(body));
}

async function main(): Promise<void> {
  const server = createServer(async (nodeReq, nodeRes) => {
    try {
      const body = await readBody(nodeReq);
      const fetchReq = await toFetchRequest(nodeReq, body);
      const fetchRes = await handleApiRequest(fetchReq);
      await fromFetchResponse(fetchRes, nodeRes);
    } catch (error) {
      console.error("Unhandled server error:", error);
      nodeRes.statusCode = 500;
      nodeRes.setHeader("content-type", "application/json; charset=utf-8");
      nodeRes.end(
        JSON.stringify({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        }),
      );
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`✓ Grace Ledger API server running on http://${HOST}:${PORT}`);
    console.log(`  Health: http://localhost:${PORT}/api/health`);
  });
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
