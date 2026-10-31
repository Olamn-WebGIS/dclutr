import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "dclutr_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

type AppSession = { userId: string; email: string; sessionVersion: number; expiresAt: number };
export type AuthContext = {
  session: AppSession;
  user: { id: string; email: string };
  profile: { id: string; display_name: string; email: string; role: "student" | "admin"; verification_status: string };
};

export class BackendError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function backendEnv() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new BackendError("Backend is not configured. Add the Supabase settings from .env.local and restart the app.", 503);
  return { url, serviceKey };
}

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new BackendError("Set SESSION_SECRET to a random secret of at least 32 characters.", 503);
  return secret;
}

function sign(value: string) { return createHmac("sha256", sessionSecret()).update(value).digest("base64url"); }

export async function saveSession(user: { id: string; email: string; sessionVersion: number }) {
  const jar = await cookies();
  const payload: AppSession = { userId: user.id, email: user.email, sessionVersion: user.sessionVersion, expiresAt: Math.floor(Date.now() / 1000) + SESSION_SECONDS };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  jar.set(SESSION_COOKIE, `${encoded}.${sign(encoded)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_SECONDS,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}

export async function getSession(): Promise<AppSession | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const [encoded, suppliedSignature] = raw.split(".");
  if (!encoded || !suppliedSignature) return null;
  let expected: string;
  try { expected = sign(encoded); } catch { return null; }
  const a = Buffer.from(suppliedSignature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as AppSession;
    if (!payload.userId || !payload.email || !Number.isInteger(payload.sessionVersion) || payload.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

async function supabaseFetch(path: string, init: RequestInit = {}) {
  const { url, serviceKey } = backendEnv();
  const headers = new Headers(init.headers);
  headers.set("apikey", serviceKey);
  headers.set("authorization", `Bearer ${serviceKey}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${url}/${path.replace(/^\//, "")}`, { ...init, headers, cache: "no-store" });
  if (!response.ok) {
    const detail = await response.text();
    let message = detail;
    try { message = JSON.parse(detail).message || JSON.parse(detail).msg || detail; } catch { /* use raw response */ }
    throw new BackendError(message || "Supabase request failed", response.status);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// All application data access uses the server-only service key. Every API route must verify
// the signed D_clutr session and enforce row ownership before calling these helpers.
export async function userFetch<T = unknown>(path: string, _session: AppSession, init: RequestInit = {}): Promise<T> {
  return await supabaseFetch(path, init) as T;
}

export async function adminFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  return await supabaseFetch(path, init) as T;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await getSession();
  if (!session) return null;
  try {
    const [rows, accounts] = await Promise.all([
      adminFetch<AuthContext["profile"][]>(`rest/v1/profiles?id=eq.${encodeURIComponent(session.userId)}&select=id,display_name,email,role,verification_status`),
      adminFetch<Array<{ session_version: number }>>(`rest/v1/app_accounts?user_id=eq.${encodeURIComponent(session.userId)}&select=session_version`),
    ]);
    const profile = rows?.[0];
    if (!profile || !accounts[0] || accounts[0].session_version !== session.sessionVersion || profile.email.toLowerCase() !== session.email.toLowerCase()) return null;
    return { session, user: { id: profile.id, email: profile.email }, profile };
  } catch { return null; }
}

export async function requireAdmin() {
  const auth = await getAuthContext();
  if (!auth) throw new BackendError("Sign in required.", 401);
  if (auth.profile.role !== "admin") throw new BackendError("Admin access required.", 403);
  return auth;
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

export function errorResponse(error: unknown) {
  if (error instanceof BackendError) return json({ error: error.message }, error.status);
  console.error("D_clutr API error:", error);
  return json({ error: "The request could not be completed." }, 500);
}

export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new BackendError(`Missing ${name}. Configure the server environment before using this feature.`, 503);
  return value;
}
