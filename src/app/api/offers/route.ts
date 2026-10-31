import { BackendError, adminFetch, errorResponse, getAuthContext, json } from "@/lib/server/backend";

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to view offers.", 401);
    const offers = await adminFetch<Array<Record<string, unknown> & { id: string; listing_id: string | null; listing_title_snapshot: string; listing_seller_id: string; buyer_id: string }>>(
      `rest/v1/offers?or=${encodeURIComponent(`(buyer_id.eq.${auth.user.id},listing_seller_id.eq.${auth.user.id})`)}&select=id,listing_id,listing_title_snapshot,listing_seller_id,buyer_id,amount_ngn,note,status,created_at,responded_at&order=created_at.desc&limit=200`,
    );
    const sent = offers.filter((offer) => offer.buyer_id === auth.user.id).map((offer) => ({ ...offer, listingTitle: offer.listing_title_snapshot }));
    const received = offers.filter((offer) => offer.listing_seller_id === auth.user.id).map((offer) => ({ ...offer, listingTitle: offer.listing_title_snapshot }));
    return json({ received, sent });
  } catch (error) { return errorResponse(error); }
}
