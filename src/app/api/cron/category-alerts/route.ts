import { timingSafeEqual } from "node:crypto";
import { adminFetch, errorResponse, json, requireEnv } from "@/lib/server/backend";
import { createEmailClickUrl, createUnsubscribeUrl } from "@/lib/server/marketing";
import { queueEmail } from "@/lib/server/mailer";

const PAGE_SIZE = 50;
const CATEGORY_ALLOWLIST = new Set(["Campus essentials", "Furniture", "Home appliances"]);
const RECENT_LISTINGS_DAYS = 8;

type AlertRecipient = {
  user_id: string;
  saved_categories: string[];
  category_alerts_since: string | null;
  last_category_digest_at: string | null;
  profiles: { display_name: string; email: string } | null;
};

type NewListing = { id: string; seller_id: string; title: string; price_ngn: number; category: string; created_at: string };

export async function GET(request: Request) {
  try {
    const expected = requireEnv("CRON_SECRET");
    const authorization = request.headers.get("authorization") || "";
    const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const a = Buffer.from(supplied);
    const b = Buffer.from(expected);
    if (!supplied || a.length !== b.length || !timingSafeEqual(a, b)) return json({ error: "Unauthorized" }, 401);

    const now = new Date();
    const recent = new Date(now.getTime() - RECENT_LISTINGS_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const recentListings: NewListing[] = [];
    let listingOffset = 0;
    while (true) {
      const page = await adminFetch<NewListing[]>(
        `rest/v1/listings?status=eq.active&expires_at=gt.${encodeURIComponent(now.toISOString())}&created_at=gte.${encodeURIComponent(recent)}&select=id,seller_id,title,price_ngn,category,created_at&order=created_at.desc&limit=500&offset=${listingOffset}`,
      );
      recentListings.push(...page);
      listingOffset += page.length;
      if (page.length < 500) break;
    }
    if (!recentListings.length) return json({ checked: 0, queued: 0 });

    let cursor = "00000000-0000-0000-0000-000000000000";
    let checked = 0;
    let queued = 0;
    let errors = 0;

    while (true) {
      const recipients = await adminFetch<AlertRecipient[]>(
        `rest/v1/email_marketing_preferences?is_subscribed=eq.true&category_alerts_enabled=eq.true&user_id=gt.${cursor}&select=user_id,saved_categories,category_alerts_since,last_category_digest_at,profiles!inner(display_name,email)&order=user_id.asc&limit=${PAGE_SIZE}`,
      );
      if (!recipients.length) break;
      cursor = recipients[recipients.length - 1].user_id;
      checked += recipients.length;

      for (const recipient of recipients) {
        const profile = recipient.profiles;
        const categories = recipient.saved_categories.filter((category) => CATEGORY_ALLOWLIST.has(category));
        if (!profile || !categories.length) continue;
        if (recipient.last_category_digest_at && now.getTime() - new Date(recipient.last_category_digest_at).getTime() < 20 * 60 * 60 * 1000) continue;
        const since = new Date(Math.max(Date.parse(recent), recipient.category_alerts_since ? Date.parse(recipient.category_alerts_since) : 0));
        const items = recentListings.filter((item) => item.seller_id !== recipient.user_id && categories.includes(item.category) && Date.parse(item.created_at) > since.getTime()).slice(0, 10);
        if (!items.length) continue;

        try {
          const itemLinks = items.map((item) => {
            const link = createEmailClickUrl(recipient.user_id, "category-alert", `/product/${item.id}`);
            return `• ${item.title} (${item.category}) — NGN ${item.price_ngn.toLocaleString("en-NG")}\n  ${link}`;
          }).join("\n\n");
          const unsubscribeUrl = createUnsubscribeUrl(recipient.user_id);
          await queueEmail({
            to: profile.email,
            subject: `New D_clutr items in ${categories.length === 1 ? categories[0] : "your saved categories"}`,
            text: `Hello ${profile.display_name},\n\nNew items have been posted in categories you chose to follow:\n\n${itemLinks}\n\nBrowse the FUTA marketplace: ${createEmailClickUrl(recipient.user_id, "category-alert", "/market")}\n\nTo stop marketplace emails, open this link: ${unsubscribeUrl}`,
            dedupeKey: `category-alert-digest:${recipient.user_id}:${now.toISOString().slice(0, 10)}`,
            unsubscribeUrl,
            deferDelivery: true,
            requiresCategoryAlertConsent: true,
          });
          await adminFetch(`rest/v1/email_marketing_preferences?user_id=eq.${recipient.user_id}&is_subscribed=eq.true&category_alerts_enabled=eq.true`, {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ last_category_digest_at: now.toISOString(), updated_at: now.toISOString() }),
          });
          queued++;
        } catch (error) {
          errors++;
          console.error("Unable to queue a saved-category alert:", error);
        }
      }

      if (recipients.length < PAGE_SIZE) break;
    }

    return json({ checked, queued, errors }, errors ? 500 : 200);
  } catch (error) { return errorResponse(error); }
}
