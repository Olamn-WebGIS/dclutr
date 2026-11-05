import { BackendError, adminFetch, errorResponse, json, saveSession } from "@/lib/server/backend";
import { assertSameOrigin } from "@/lib/server/security";
import { allowAuthAttempt, checkRateLimit, hashPassword, verifyPassword } from "@/lib/server/password-auth";

const dummyHashPromise = hashPassword("D_clutr_nonexistent_account_timing_guard");

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await request.json() as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length > 128) throw new BackendError("Email or password is incorrect.", 401);
    await allowAuthAttempt(email, request);
    if (!await checkRateLimit("login-ip", request, 40, 900)) throw new BackendError("Too many sign-in attempts from this connection. Try again later.", 429);
    const profiles = await adminFetch<Array<{ id: string; email: string; account_banned: boolean; account_deleted: boolean }>>(`rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,email,account_banned,account_deleted&limit=1`);
    const profile = profiles[0];
    if (profile?.account_banned || profile?.account_deleted) throw new BackendError("This account is disabled. Contact D_clutr support for assistance.", 403);
    const accounts = profile ? await adminFetch<Array<{ password_hash: string; session_version: number }>>(`rest/v1/app_accounts?user_id=eq.${profile.id}&select=password_hash,session_version`) : [];
    const passwordHash = accounts[0]?.password_hash ?? await dummyHashPromise;
    const valid = await verifyPassword(password, passwordHash);
    if (!profile || !accounts[0] || !valid) throw new BackendError("Email or password is incorrect.", 401);
    await saveSession({ id: profile.id, email: profile.email, sessionVersion: accounts[0].session_version });
    return json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
