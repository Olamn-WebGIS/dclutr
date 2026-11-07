import { randomUUID } from "node:crypto";
import { BackendError, adminFetch, errorResponse, json, saveSession } from "@/lib/server/backend";
import { assertSameOrigin } from "@/lib/server/security";
import { allowAuthAttempt, checkRateLimit, hashPassword } from "@/lib/server/password-auth";
import { queueEmail } from "@/lib/server/mailer";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await request.json() as { name?: string; email?: string; password?: string; marketingConsent?: boolean; priceAlertConsent?: boolean };
    const name = body.name?.trim().replace(/\s+/g, " ");
    const email = body.email?.trim().toLowerCase();
    if (!name || name.length < 2 || name.length > 80 || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !body.password || body.password.length < 12 || body.password.length > 128) {
      throw new BackendError("Enter your name, a valid email address, and a password between 12 and 128 characters.", 400);
    }
    await allowAuthAttempt(email, request, 5);
    if (!await checkRateLimit("signup-ip", request, 10, 3600)) throw new BackendError("Too many account creations from this connection. Try again later.", 429);
    const passwordHash = await hashPassword(body.password);
    const userId = randomUUID();
    await adminFetch("rest/v1/rpc/create_dclutr_account_with_marketing", { method: "POST", body: JSON.stringify({ p_user_id: userId, p_display_name: name, p_email: email, p_password_hash: passwordHash, p_marketing_consent: body.marketingConsent === true, p_price_alert_consent: body.priceAlertConsent === true }) });
    await saveSession({ id: userId, email, sessionVersion: 0 });
    try { await queueEmail({ to: email, subject: "Your D_clutr account is ready", text: `Hello ${name},\n\nYour D_clutr account has been created. You can now sign in and use the FUTA student marketplace.\n\nFor your security, do not share your password with anyone.`, dedupeKey: `welcome:${userId}` }); } catch (error) { console.error("Welcome email queued for retry:", error); }
    return json({ ok: true, signedIn: true });
  } catch (error) { return errorResponse(error); }
}
