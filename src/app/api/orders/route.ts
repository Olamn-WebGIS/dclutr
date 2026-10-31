import { BackendError, errorResponse, getAuthContext, json, userFetch } from "@/lib/server/backend";

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to view your orders.", 401);
    const [buying, selling] = await Promise.all([
      userFetch<Array<Record<string, unknown>>>(`rest/v1/orders?buyer_id=eq.${auth.user.id}&select=id,conversation_id,listing_id,buyer_id,seller_id,amount_ngn,buyer_fee_ngn,seller_fee_ngn,buyer_total_ngn,seller_payout_ngn,status,buyer_terms_accepted_at,seller_terms_accepted_at,paid_at,dispatched_at,delivered_at,payout_due_at,payout_paid_at,created_at&order=created_at.desc`, auth.session),
      userFetch<Array<Record<string, unknown>>>(`rest/v1/orders?seller_id=eq.${auth.user.id}&select=id,conversation_id,listing_id,buyer_id,seller_id,amount_ngn,buyer_fee_ngn,seller_fee_ngn,buyer_total_ngn,seller_payout_ngn,status,buyer_terms_accepted_at,seller_terms_accepted_at,paid_at,dispatched_at,delivered_at,payout_due_at,payout_paid_at,created_at&order=created_at.desc`, auth.session),
    ]);
    return json({ orders: [...new Map([...buying, ...selling].map((order) => [order.id, order])).values()] });
  } catch (error) { return errorResponse(error); }
}
