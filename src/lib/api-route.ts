import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { AUTH_COOKIE_NAME, verifySessionToken, type VerifiedSession } from "@/lib/auth-session";
import { NotFoundError, ConflictError } from "@/lib/db/errors";
import { consumeApiLimit } from "@/lib/api-rate-limit";

export class RouteError extends Error {
  constructor(readonly status: number, message: string) { super(message); this.name = "RouteError"; }
}
export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(data, { status, headers });
}

export async function requireViewer(request: Request): Promise<VerifiedSession> {
  if (process.env.NODE_ENV === "production" && !process.env.AUTH_SESSION_SECRET) {
    throw new Error("AUTH_SESSION_SECRET is required");
  }
  const jar = new NextRequest(request.url, { headers: request.headers }).cookies;
  const token = jar.get(AUTH_COOKIE_NAME)?.value;
  if (!token || token.length > 4096 || token.split(".").length !== 2) throw new RouteError(401, "Unauthorized");
  let session: VerifiedSession | null;
  try {
    session = await verifySessionToken(token);
  } catch (error) {
    if (!(error instanceof SyntaxError) && !(error instanceof DOMException)) throw error;
    session = null;
  }
  if (!session) throw new RouteError(401, "Unauthorized");
  return session;
}

export async function requireOwner(request: Request): Promise<VerifiedSession> {
  const viewer = await requireViewer(request);
  if (viewer.role !== "owner") throw new RouteError(403, "Forbidden");
  if (request.headers.get("origin") !== new URL(request.url).origin) throw new RouteError(403, "Invalid origin");
  return viewer;
}

export async function readJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new RouteError(400, "Expected application/json");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new RouteError(400, "Invalid JSON body");
  let bytes = 0;
  let text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 256 * 1024) { await reader.cancel(); throw new RouteError(400, "JSON body is too large"); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  try { return JSON.parse(text); }
  catch (error) {
    if (error instanceof SyntaxError) throw new RouteError(400, "Invalid JSON body");
    throw error;
  }
}

function errorResponse(error: unknown, request: Request): Response {
  if (error instanceof RouteError) return json({ error: error.message }, error.status);
  if (error instanceof ZodError) return json({ error: "Invalid request" }, 400);
  if (error instanceof NotFoundError) return json({ error: error.message }, 404);
  if (error instanceof ConflictError) return json({ error: error.message }, 409);
  console.error("API request failed", { method: request.method, path: new URL(request.url).pathname, error });
  return json({ error: "Internal server error" }, 500);
}

export async function handleRoute(request: Request, operation: () => Promise<Response>): Promise<Response> {
  let response: Response;
  try {
    const budget = consumeApiLimit();
    response = budget.allowed ? await operation() : json({ error: "Too many requests" }, 429, { "Retry-After": String(budget.retryAfter) });
  } catch (error) { response = errorResponse(error, request); }
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, headers });
}
