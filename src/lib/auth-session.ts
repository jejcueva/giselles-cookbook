import { AUTH_COOKIE_NAME } from "@/lib/auth-cookie";
import { roleForAccount, type SessionRole } from "@/lib/auth-roles";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();

type SessionPayload = {
  u: string;
  r?: SessionRole;
  exp: number;
};

export type VerifiedSession = {
  username: string;
  role: SessionRole;
};

function getSessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SESSION_SECRET is required");
  }
  return secret || "dev-only-cute-cookbook-session-secret";
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function createHmacKey() {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionToken(username: string): Promise<string> {
  const payload: SessionPayload = {
    u: username,
    r: roleForAccount(username),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const payloadEncoded = toBase64Url(encoder.encode(JSON.stringify(payload)).buffer);
  const key = await createHmacKey();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadEncoded));
  return `${payloadEncoded}.${toBase64Url(signature)}`;
}

export async function verifySessionToken(token: string): Promise<VerifiedSession | null> {
  const [payloadEncoded, signatureEncoded] = token.split(".");
  if (!payloadEncoded || !signatureEncoded) return null;

  const key = await createHmacKey();
  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    fromBase64Url(signatureEncoded),
    encoder.encode(payloadEncoded)
  );
  if (!isValid) return null;

  const payloadText = new TextDecoder().decode(fromBase64Url(payloadEncoded));
  const payload = JSON.parse(payloadText) as SessionPayload;
  if (!payload?.u || !payload?.exp) return null;
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;

  const role = payload.r === "recruiter" || payload.r === "owner" ? payload.r : roleForAccount(payload.u);
  return { username: payload.u, role };
}

export function sessionCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function clearSessionCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

export { AUTH_COOKIE_NAME };

