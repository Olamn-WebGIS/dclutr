import "server-only";
import { adminFetch } from "@/lib/server/backend";
import { recordMarketplaceEventSafely } from "@/lib/server/marketplace-analytics";

const STOP_WORDS = new Set(["a", "an", "and", "for", "i", "in", "is", "it", "me", "of", "on", "or", "the", "to", "with"]);
const ALIASES: Record<string, string> = {
  bed: "mattress",
  fridge: "refrigerator",
  freezer: "refrigerator",
  mattress: "mattress",
  refrigerator: "refrigerator",
};

function tokens(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
    .map((token) => {
      const singular = token.endsWith("s") && token.length > 3 ? token.slice(0, -1) : token;
      return ALIASES[singular] ?? singular;
    });
}

export function matchesPriceAlert(query: string, listingTitle: string) {
  const wanted = tokens(query);
  const offered = new Set(tokens(listingTitle));
  return wanted.length > 0 && wanted.some((token) => offered.has(token));
}

export async function savePriceAlertInterests(userId: string, query: string, listingIds: string[]) {
  const preferences = await adminFetch<Array<{ is_subscribed: boolean; price_alerts_enabled: boolean }>>(
    `rest/v1/email_marketing_preferences?user_id=eq.${encodeURIComponent(userId)}&select=is_subscribed,price_alerts_enabled`,
  );
  if (!preferences[0]?.is_subscribed || !preferences[0].price_alerts_enabled) return { saved: 0, enabled: false };

  const uniqueIds = [...new Set(listingIds)].slice(0, 20);
  if (!uniqueIds.length) return { saved: 0, enabled: true };
  const listings = await adminFetch<Array<{ id: string; seller_id: string; title: string; category: string; price_ngn: number }>>(
    `rest/v1/listings?id=in.(${uniqueIds.join(",")})&status=eq.active&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,seller_id,title,category,price_ngn`,
  );
  const interests = listings
    .filter((listing) => listing.seller_id !== userId && matchesPriceAlert(query, listing.title))
    .map((listing) => ({
      user_id: userId,
      source_listing_id: listing.id,
      search_term: query.slice(0, 100),
      category: listing.category,
      reference_price_ngn: listing.price_ngn,
      updated_at: new Date().toISOString(),
    }));
  if (interests.length) {
    await adminFetch("rest/v1/email_price_alert_interests?on_conflict=user_id,source_listing_id,search_term", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(interests),
    });
  }
  await recordMarketplaceEventSafely({ userId, event: "market_visit" });
  return { saved: interests.length, enabled: true };
}

export async function savePriceAlertInterestsSafely(userId: string, query: string, listingIds: string[]) {
  try {
    return await savePriceAlertInterests(userId, query, listingIds);
  } catch (error) {
    console.error("Unable to save D_clutr price-alert interests:", error);
    throw error;
  }
}
