import { timingSafeEqual } from "node:crypto";
import { adminFetch, errorResponse, json, requireEnv } from "@/lib/server/backend";
import { createEmailClickUrl, createUnsubscribeUrl } from "@/lib/server/marketing";
import { queueEmail } from "@/lib/server/mailer";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SLOW_CADENCE_MS = 30 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 100;

type MarketingRecipient = {
  user_id: string;
  last_lifecycle_week: number;
  last_lifecycle_sent_at: string | null;
  last_engaged_at: string | null;
  unengaged_reminder_streak: number;
  profiles: { display_name: string; email: string; created_at: string } | null;
};

export async function GET(request: Request) {
  try {
    const expected = requireEnv("CRON_SECRET");
    const authorization = request.headers.get("authorization") || "";
    const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const a = Buffer.from(supplied);
    const b = Buffer.from(expected);
    if (!supplied || a.length !== b.length || !timingSafeEqual(a, b)) return json({ error: "Unauthorized" }, 401);

    const now = new Date();
    let cursor = "00000000-0000-0000-0000-000000000000";
    let checked = 0;
    let queued = 0;
    let errors = 0;

    while (true) {
      const recipients = await adminFetch<MarketingRecipient[]>(
        `rest/v1/email_marketing_preferences?is_subscribed=eq.true&lifecycle_emails_enabled=eq.true&user_id=gt.${cursor}&profiles.created_at=lt.${encodeURIComponent(new Date(now.getTime() - WEEK_MS).toISOString())}&select=user_id,last_lifecycle_week,last_lifecycle_sent_at,last_engaged_at,unengaged_reminder_streak,profiles!inner(display_name,email,created_at)&order=user_id.asc&limit=${PAGE_SIZE}`,
      );
      if (recipients.length === 0) break;
      cursor = recipients[recipients.length - 1].user_id;
      checked += recipients.length;

      for (const recipient of recipients) {
        const profile = recipient.profiles;
        if (!profile) continue;
        const accountAgeWeeks = Math.floor((now.getTime() - new Date(profile.created_at).getTime()) / WEEK_MS);
        if (accountAgeWeeks < 1 || accountAgeWeeks <= recipient.last_lifecycle_week) continue;
        const engagedSinceLastEmail = recipient.last_engaged_at && (!recipient.last_lifecycle_sent_at || recipient.last_engaged_at > recipient.last_lifecycle_sent_at);
        const streak = engagedSinceLastEmail ? 0 : recipient.unengaged_reminder_streak;
        const cadenceMs = streak >= 3 ? SLOW_CADENCE_MS : WEEK_MS;
        if (recipient.last_lifecycle_sent_at && now.getTime() - new Date(recipient.last_lifecycle_sent_at).getTime() < cadenceMs) continue;

        try {
          const unsubscribeUrl = createUnsubscribeUrl(recipient.user_id);
          const marketUrl = createEmailClickUrl(recipient.user_id, "weekly-reminder", "/market");
          await queueEmail({
            to: profile.email,
            subject: "A little reminder from D_clutr",
            text: `Hello ${profile.display_name},\n\nWhenever you have something to sell or are looking to buy, D_clutr is here for FUTA students in Akure. Check back to see what’s available or list an item another student might need.\n\nKnow another FUTA student who could use the marketplace? Please share D_clutr with them.\n\nVisit D_clutr: ${marketUrl}\n\nTo stop these marketplace reminders, open this link: ${unsubscribeUrl}`,
            dedupeKey: `marketing-lifecycle:${recipient.user_id}:${accountAgeWeeks}`,
            unsubscribeUrl,
            deferDelivery: true,
            requiresLifecycleConsent: true,
          });
          await adminFetch(`rest/v1/email_marketing_preferences?user_id=eq.${recipient.user_id}&is_subscribed=eq.true&lifecycle_emails_enabled=eq.true&last_lifecycle_week=eq.${recipient.last_lifecycle_week}`, {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
              last_lifecycle_week: accountAgeWeeks,
              last_lifecycle_sent_at: now.toISOString(),
              unengaged_reminder_streak: engagedSinceLastEmail ? 0 : streak + 1,
              updated_at: now.toISOString(),
            }),
          });
          queued++;
        } catch (error) {
          errors++;
          console.error("Unable to queue a lifecycle marketing email:", error);
        }
      }

      if (recipients.length < PAGE_SIZE) break;
    }

    return json({ checked, queued, errors }, errors ? 500 : 200);
  } catch (error) { return errorResponse(error); }
}
