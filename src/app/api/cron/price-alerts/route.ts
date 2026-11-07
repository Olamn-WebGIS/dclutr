import { timingSafeEqual } from "node:crypto";
import { adminFetch, errorResponse, json, requireEnv } from "@/lib/server/backend";
import { createEmailClickUrl, createUnsubscribeUrl } from "@/lib/server/marketing";
import { matchesPriceAlert } from "@/lib/server/price-alerts";
import { queueEmail } from "@/lib/server/mailer";

type Interest = {
  id: string;
  user_id: string;
  search_term: string;
  category: string;
  reference_price_ngn: number;
  created_at: string;
};
type Listing = { id: string; seller_id: string; title: string; category: string; price_ngn: number; created_at: string };
type Recipient = { display_name: string; email: string };
type Purchase = { item_title: string; status: string; created_at: string };

export async function GET(request: Request) {
  try {
    const expected = requireEnv("CRON_SECRET");
    const authorization = request.headers.get("authorization") || "";
    const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const a = Buffer.from(supplied);
    const b = Buffer.from(expected);
    if (!supplied || a.length !== b.length || !timingSafeEqual(a, b)) return json({ error: "Unauthorized" }, 401);

    const now = new Date();
    const since = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const [listings, interests] = await Promise.all([
      adminFetch<Listing[]>(`rest/v1/listings?status=eq.active&expires_at=gt.${encodeURIComponent(now.toISOString())}&created_at=gte.${encodeURIComponent(since)}&select=id,seller_id,title,category,price_ngn,created_at&order=created_at.desc&limit=1000`),
      adminFetch<Interest[]>(`rest/v1/email_price_alert_interests?created_at=gte.${encodeURIComponent(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())}&select=id,user_id,search_term,category,reference_price_ngn,created_at&order=created_at.desc&limit=5000`),
    ]);

    const matchesByUser = new Map<string, Map<string, Listing>>();
    for (const interest of interests) {
      const candidates = listings.filter((listing) =>
        listing.seller_id !== interest.user_id
        && listing.category === interest.category
        && listing.price_ngn < interest.reference_price_ngn
        && Date.parse(listing.created_at) > Date.parse(interest.created_at)
        && matchesPriceAlert(interest.search_term, listing.title),
      );
      if (!candidates.length) continue;
      const matches = matchesByUser.get(interest.user_id) ?? new Map<string, Listing>();
      for (const listing of candidates) matches.set(listing.id, listing);
      matchesByUser.set(interest.user_id, matches);
    }

    let queued = 0;
    let errors = 0;
    for (const [userId, listingMap] of matchesByUser) {
      try {
        const [preferences, profiles, purchases] = await Promise.all([
          adminFetch<Array<{ is_subscribed: boolean; price_alerts_enabled: boolean; price_alerts_since: string | null; last_price_alert_at: string | null }>>(`rest/v1/email_marketing_preferences?user_id=eq.${userId}&select=is_subscribed,price_alerts_enabled,price_alerts_since,last_price_alert_at`),
          adminFetch<Recipient[]>(`rest/v1/profiles?id=eq.${userId}&select=display_name,email`),
          adminFetch<Purchase[]>(`rest/v1/orders?buyer_id=eq.${userId}&status=in.(paid,dispatched,delivered,completed,disputed)&select=item_title,status,created_at&order=created_at.desc&limit=100`),
        ]);
        const preference = preferences[0];
        const recipient = profiles[0];
        if (!preference?.is_subscribed || !preference.price_alerts_enabled || !recipient) continue;
        if (preference.last_price_alert_at && now.getTime() - Date.parse(preference.last_price_alert_at) < 20 * 60 * 60 * 1000) continue;

        const alertsEnabledAt = preference.price_alerts_since ? Date.parse(preference.price_alerts_since) : now.getTime();
        const interestTerms = interests.filter((interest) => interest.user_id === userId);
        const purchasedSimilarItem = purchases.some((purchase) =>
          interestTerms.some((interest) => Date.parse(purchase.created_at) >= Date.parse(interest.created_at) && matchesPriceAlert(interest.search_term, purchase.item_title)),
        );
        if (purchasedSimilarItem) continue;
        const matched = [...listingMap.values()].filter((listing) => Date.parse(listing.created_at) >= alertsEnabledAt).slice(0, 10);
        if (!matched.length) continue;
        const links = matched.map((listing) => `• ${listing.title} — NGN ${listing.price_ngn.toLocaleString("en-NG")}\n  ${createEmailClickUrl(userId, "price-alert", `/product/${listing.id}`)}`).join("\n\n");
        const unsubscribeUrl = createUnsubscribeUrl(userId);
        await queueEmail({
          to: recipient.email,
          subject: `A lower-priced ${matched.length === 1 ? "item is" : "items are"} on D_clutr`,
          text: `Hello ${recipient.display_name},\n\nYou recently searched for or viewed similar items. These newer listings match what you were looking for and are priced lower than the items you viewed:\n\n${links}\n\nBrowse the FUTA marketplace: ${createEmailClickUrl(userId, "price-alert", "/market")}\n\nTo stop marketplace emails, open this link: ${unsubscribeUrl}`,
          dedupeKey: `price-alert-digest:${userId}:${now.toISOString().slice(0, 10)}`,
          unsubscribeUrl,
          deferDelivery: true,
          requiresPriceAlertConsent: true,
        });
        await adminFetch(`rest/v1/email_marketing_preferences?user_id=eq.${userId}&is_subscribed=eq.true&price_alerts_enabled=eq.true`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ last_price_alert_at: now.toISOString(), updated_at: now.toISOString() }),
        });
        queued++;
      } catch (error) {
        errors++;
        console.error("Unable to queue a lower-price alert:", error);
      }
    }
    return json({ interests: interests.length, recipients: matchesByUser.size, queued, errors }, errors ? 500 : 200);
  } catch (error) { return errorResponse(error); }
}
