import { BackendError, adminFetch, errorResponse, json, saveSession } from "@/lib/server/backend";
import { assertSameOrigin } from "@/lib/server/security";
import { checkRateLimit, hashPassword, resetTokenHash } from "@/lib/server/password-auth";
import { queueEmail } from "@/lib/server/mailer";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { token, password } = await request.json() as { token?: string; password?: string };
    if (!token || token.length < 30 || token.length > 200 || !password || password.length < 6 || password.length > 128) throw new BackendError("Use a valid reset link and a password between 6 and 128 characters.");
    if (!await checkRateLimit("reset-password-ip", request, 10, 3600)) throw new BackendError("Too many reset attempts. Try again later.", 429);
    if (!await checkRateLimit(`reset-token:${resetTokenHash(token)}`, request, 6, 1800)) throw new BackendError("Too many attempts for this reset link.", 429);
    const hash = resetTokenHash(token);
    const accounts = await adminFetch<Array<{ user_id: string; session_version: number }>>(`rest/v1/app_accounts?password_reset_hash=eq.${hash}&password_reset_expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=user_id,session_version&limit=1`);
    const account = accounts[0];
    if (!account) throw new BackendError("This reset link has expired or was already used. Request a new one.", 400);
    const passwordHash = await hashPassword(password);
    const updated = await adminFetch<Array<{ user_id: string }>>(`rest/v1/app_accounts?user_id=eq.${account.user_id}&password_reset_hash=eq.${hash}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ password_hash: passwordHash, password_reset_hash: null, password_reset_expires_at: null, session_version: account.session_version + 1 }) });
    if (!updated.length) throw new BackendError("This reset link has already been used. Request a new one.", 400);
    const profiles = await adminFetch<Array<{ email: string; display_name: string }>>(`rest/v1/profiles?id=eq.${account.user_id}&select=email,display_name`);
    const profile = profiles[0];
    if (profile) {
      const refreshed = await adminFetch<Array<{ session_version: number }>>(`rest/v1/app_accounts?user_id=eq.${account.user_id}&select=session_version`);
      if (refreshed[0]) await saveSession({ id: account.user_id, email: profile.email, sessionVersion: refreshed[0].session_version });
      try { await queueEmail({ to: profile.email, subject: "Password changed for your D_clutr account", text: `Hello ${profile.display_name},\n\nThe password for your D_clutr account was changed successfully.\n\nIf you did not make this change, contact the D_clutr administrator as soon as possible.`, dedupeKey: `password-changed:${account.user_id}:${Date.now()}` }); } catch (error) { console.error("Password-change email queued for retry:", error); }
    }
    return json({ ok: true, message: "Your password was updated. Sign in with your new password." });
  } catch (error) { return errorResponse(error); }
}
