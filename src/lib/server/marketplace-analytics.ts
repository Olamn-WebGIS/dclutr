import "server-only";
import { adminFetch } from "@/lib/server/backend";

export type MarketplaceEvent = "market_visit" | "listing_view" | "listing_created" | "first_conversation" | "order_completed" | "email_click";

const ENGAGEMENT_EVENTS: MarketplaceEvent[] = ["market_visit", "listing_view", "listing_created", "first_conversation", "order_completed", "email_click"];

function dayStamp(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function recordMarketplaceEvent({
  userId,
  event,
  entityId,
  campaign,
}: {
  userId: string;
  event: MarketplaceEvent;
  entityId?: string;
  campaign?: string;
}) {
  const now = new Date();
  const dedupeKey = event === "market_visit"
    ? `${event}:${userId}:${dayStamp(now)}`
    : event === "listing_view"
      ? `${event}:${userId}:${entityId}:${dayStamp(now)}`
      : event === "email_click"
        ? `${event}:${userId}:${campaign}:${dayStamp(now)}`
        : `${event}:${entityId}`;

  await adminFetch("rest/v1/marketplace_analytics_events?on_conflict=dedupe_key", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({
      user_id: userId,
      event_type: event,
      entity_id: entityId ?? null,
      campaign: campaign ?? null,
      dedupe_key: dedupeKey,
    }),
  });

  if (ENGAGEMENT_EVENTS.includes(event)) {
    await adminFetch(`rest/v1/email_marketing_preferences?user_id=eq.${encodeURIComponent(userId)}&is_subscribed=eq.true`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ last_engaged_at: now.toISOString(), updated_at: now.toISOString() }),
    });
  }
}

export async function recordMarketplaceEventSafely(args: Parameters<typeof recordMarketplaceEvent>[0]) {
  try {
    await recordMarketplaceEvent(args);
  } catch (error) {
    console.error(`Unable to record D_clutr ${args.event} analytics:`, error);
  }
}
