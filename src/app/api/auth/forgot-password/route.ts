import { BackendError, adminFetch, errorResponse, json } from "@/lib/server/backend";
import { assertSameOrigin } from "@/lib/server/security";
import { allowAuthAttempt, checkRateLimit, newResetToken, resetTokenHash } from "@/lib/server/password-auth";
import { queueEmail } from "@/lib/server/mailer";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { email: rawEmail } = await request.json() as { email?: string };
    const email = rawEmail?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BackendError("Enter the email address used for your account.");
    await allowAuthAttempt(email, request, 4);
    if (!await checkRateLimit("forgot-password-ip", request, 10, 3600)) throw new BackendError("Too many reset requests. Try again later.", 429);
    const profiles = await adminFetch<Array<{ id: string; display_name: string }>>(`rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,display_name&limit=1`);
    if (profiles[0]) {
      const token = newResetToken();
      await adminFetch(`rest/v1/app_accounts?user_id=eq.${profiles[0].id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ password_reset_hash: resetTokenHash(token), password_reset_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() }) });
      const base = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
      try {
        await queueEmail({ to: email, subject: "Reset your D_clutr password", text: `Hello ${profiles[0].display_name},\n\nUse this one-time link to choose a new D_clutr password. It expires in 30 minutes:\n${base}/reset-password?token=${encodeURIComponent(token)}\n\nD_clutr cannot retrieve or email your current password. If you did not request this, ignore this message.`, dedupeKey: `password-reset:${profiles[0].id}:${resetTokenHash(token).slice(0, 16)}` });
      } catch (error) { console.error("Password reset email queued for retry:", error); }
    }
    return json({ ok: true, message: "If an account exists for that email, a password reset link will be sent." });
  } catch (error) { return errorResponse(error); }
}
