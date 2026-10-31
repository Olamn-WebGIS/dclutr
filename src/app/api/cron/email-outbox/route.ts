import { timingSafeEqual } from "node:crypto";
import { adminFetch, errorResponse, json, requireEnv } from "@/lib/server/backend";
import { deliverQueuedEmail } from "@/lib/server/mailer";

export async function GET(request: Request) {
  try {
    const expected = requireEnv("CRON_SECRET");
    const authorization = request.headers.get("authorization") || "";
    const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const a = Buffer.from(supplied); const b = Buffer.from(expected);
    if (!supplied || a.length !== b.length || !timingSafeEqual(a, b)) return json({ error: "Unauthorized" }, 401);
    const queued = await adminFetch<Array<{ id: string }>>("rest/v1/email_outbox?status=eq.queued&select=id&order=created_at.asc&limit=50");
    let sent = 0;
    for (const item of queued) if (await deliverQueuedEmail(item.id)) sent++;
    return json({ queued: queued.length, sent });
  } catch (error) { return errorResponse(error); }
}
