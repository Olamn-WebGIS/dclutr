import "server-only";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { adminFetch, BackendError, requireEnv } from "@/lib/server/backend";

const KEY_BYTES = 64;
const scrypt = (password: string, salt: Buffer, length: number) => new Promise<Buffer>((resolve, reject) => {
  scryptCallback(password, salt, length, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, derived) => {
    if (error) reject(error); else resolve(derived as Buffer);
  });
});

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_BYTES);
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, n, r, p, saltValue, expectedValue] = encoded.split("$");
  if (algorithm !== "scrypt" || n !== "16384" || r !== "8" || p !== "1" || !saltValue || !expectedValue) return false;
  try {
    const expected = Buffer.from(expectedValue, "base64url");
    const actual = await scrypt(password, Buffer.from(saltValue, "base64url"), expected.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch { return false; }
}

export function newResetToken() { return randomBytes(32).toString("base64url"); }
export function resetTokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }

export async function checkRateLimit(scope: string, request: Request, limit: number, windowSeconds = 900) {
  const secret = requireEnv("SESSION_SECRET");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const keyHash = createHash("sha256").update(`${secret}:${scope.toLowerCase()}:${ip}`).digest("hex");
  const allowed = await adminFetch<boolean>("rest/v1/rpc/consume_auth_attempt", {
    method: "POST", body: JSON.stringify({ p_key_hash: keyHash, p_limit: limit, p_window_seconds: windowSeconds }),
  });
  if (typeof allowed !== "boolean") throw new BackendError("Authentication is temporarily unavailable.", 503);
  return allowed;
}

export async function allowAuthAttempt(email: string, request: Request, limit = 8) {
  const allowed = await checkRateLimit(`auth:${email}`, request, limit, 900);
  if (!allowed) throw new BackendError("Too many attempts. Wait 15 minutes and try again.", 429);
}
