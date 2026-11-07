import { timingSafeEqual } from "node:crypto";
import { adminFetch, errorResponse, json, requireEnv } from "@/lib/server/backend";
import { createEmailClickUrl } from "@/lib/server/marketing";
import { queueEmail } from "@/lib/server/mailer";

type ExpiringListing = {
  id: string;
  seller_id: string;
  title: string;
  expires_at: string;
  seller: { display_name: string; email: string } | null;
};

export async function GET(request: Request) {
  try {
    const expected = requireEnv("CRON_SECRET");
    const authorization = request.headers.get("authorization") || "";
    const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const a = Buffer.from(supplied);
    const b = Buffer.from(expected);
    if (!supplied || a.length !== b.length || !timingSafeEqual(a, b)) return json({ error: "Unauthorized" }, 401);

    const now = Date.now();
    const from = encodeURIComponent(new Date(now + 24 * 60 * 60 * 1000).toISOString());
    const to = encodeURIComponent(new Date(now + 48 * 60 * 60 * 1000).toISOString());
    const listings = await adminFetch<ExpiringListing[]>(
      `rest/v1/listings?status=eq.active&expires_at=gte.${from}&expires_at=lt.${to}&select=id,seller_id,title,expires_at,seller:profiles!listings_seller_id_fkey(display_name,email)&order=expires_at.asc&limit=200`,
    );
    let queued = 0;
    let errors = 0;
    for (const listing of listings) {
      if (!listing.seller?.email) continue;
      try {
        const destination = `/sell?relist=${encodeURIComponent(listing.id)}`;
        const relistUrl = createEmailClickUrl(listing.seller_id, "listing-expiry", destination);
        await queueEmail({
          to: listing.seller.email,
          subject: "Your D_clutr listing expires soon",
          text: `Hello ${listing.seller.display_name},\n\nYour listing “${listing.title}” is scheduled to expire on ${new Date(listing.expires_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })} WAT.\n\nIf it is still available, use this quick link to prepare a fresh listing before this one expires. You’ll need to add the photos again:\n${relistUrl}\n\nIf it has sold, you can ignore this reminder.`,
          dedupeKey: `listing-expiry-reminder:${listing.id}`,
          deferDelivery: true,
        });
        queued++;
      } catch (error) {
        errors++;
        console.error("Unable to queue a listing expiry reminder:", error);
      }
    }
    return json({ checked: listings.length, queued, errors }, errors ? 500 : 200);
  } catch (error) { return errorResponse(error); }
}
