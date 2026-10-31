import { BackendError, adminFetch, errorResponse, getAuthContext, json, userFetch } from "@/lib/server/backend";

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to view conversations.", 401);
    const [buyer, seller] = await Promise.all([
      userFetch<Array<{ id: string; listing_id: string | null; listing_title_snapshot: string; buyer_id: string; seller_id: string; created_at: string }>>(`rest/v1/conversations?buyer_id=eq.${auth.user.id}&select=id,listing_id,listing_title_snapshot,buyer_id,seller_id,created_at&order=last_message_at.desc`, auth.session),
      userFetch<Array<{ id: string; listing_id: string | null; listing_title_snapshot: string; buyer_id: string; seller_id: string; created_at: string }>>(`rest/v1/conversations?seller_id=eq.${auth.user.id}&select=id,listing_id,listing_title_snapshot,buyer_id,seller_id,created_at&order=last_message_at.desc`, auth.session),
    ]);
    const rows = [...new Map([...buyer, ...seller].map((row) => [row.id, row])).values()];
    const conversations = await Promise.all(rows.map(async (row) => {
      const [listings, otherProfiles, orders] = await Promise.all([
        row.listing_id ? adminFetch<Array<{ title: string; price_ngn: number }>>(`rest/v1/listings?id=eq.${row.listing_id}&select=title,price_ngn`) : Promise.resolve([]),
        adminFetch<Array<{ display_name: string }>>(`rest/v1/profiles?id=eq.${row.buyer_id === auth.user.id ? row.seller_id : row.buyer_id}&select=display_name`),
        adminFetch<Array<{ amount_ngn: number }>>(`rest/v1/orders?conversation_id=eq.${row.id}&select=amount_ngn`),
      ]);
      return { ...row, listingTitle: listings[0]?.title ?? row.listing_title_snapshot, priceNgn: listings[0]?.price_ngn ?? orders[0]?.amount_ngn ?? 0, otherName: otherProfiles[0]?.display_name ?? "FUTA student", role: row.buyer_id === auth.user.id ? "buyer" : "seller" };
    }));
    return json({ conversations });
  } catch (error) { return errorResponse(error); }
}
