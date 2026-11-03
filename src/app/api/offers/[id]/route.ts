import { BackendError, adminFetch, errorResponse, getAuthContext, json, userFetch } from "@/lib/server/backend";
import { assertSameOrigin, assertUuid } from "@/lib/server/security";
import { formatNaira } from "@/lib/currency";
import { notifyOrderParticipantsByRole, notifyUser } from "@/lib/server/mailer";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to respond to offers.", 401);
    const { id } = await params;
    assertUuid(id);
    const { decision } = await request.json() as { decision?: string };
    const offers = await adminFetch<Array<{ id: string; buyer_id: string; listing_id: string; amount_ngn: number }>>(`rest/v1/offers?id=eq.${id}&select=id,buyer_id,listing_id,amount_ngn`);
    const offer = offers[0];
    if (!offer) throw new BackendError("Offer not found.", 404);
    const listings = await adminFetch<Array<{ title: string }>>(`rest/v1/listings?id=eq.${offer.listing_id}&select=title`);
    const title = listings[0]?.title ?? "your listing";
    if (decision === "reject") {
      await userFetch("rest/v1/rpc/reject_offer", auth.session, { method: "POST", body: JSON.stringify({ p_offer_id: id, p_actor_id: auth.user.id }) });
      await notifyUser(offer.buyer_id, "Your D_clutr offer was declined", `The seller declined your ${formatNaira(offer.amount_ngn)} offer for “${title}”. You can continue browsing other FUTA listings.`, `offer:declined:${id}`);
      return json({ ok: true, message: "Offer declined." });
    }
    if (decision !== "accept") throw new BackendError("Choose accept or reject.");
    const conversationId = await userFetch<string>("rest/v1/rpc/accept_offer", auth.session, { method: "POST", body: JSON.stringify({ p_offer_id: id, p_actor_id: auth.user.id }) });
    const orders = await userFetch<Array<{ id: string; buyer_id: string; seller_id: string; amount_ngn: number; buyer_fee_ngn: number; seller_fee_ngn: number; buyer_total_ngn: number; seller_payout_ngn: number }>>(`rest/v1/orders?conversation_id=eq.${conversationId}&select=id,buyer_id,seller_id,amount_ngn,buyer_fee_ngn,seller_fee_ngn,buyer_total_ngn,seller_payout_ngn`, auth.session);
    const order = orders[0];
    if (order) await notifyOrderParticipantsByRole(order.buyer_id, order.seller_id, "Your D_clutr offer was accepted", `Your offer for “${title}” was accepted at ${formatNaira(order.amount_ngn)}. Your 2% buyer fee is ${formatNaira(order.buyer_fee_ngn)}, so your total will be ${formatNaira(order.buyer_total_ngn)}. Open your chat to review the exchange terms.`, `The offer for “${title}” was accepted at ${formatNaira(order.amount_ngn)}. Your 5% seller fee is ${formatNaira(order.seller_fee_ngn)}, so your estimated payout is ${formatNaira(order.seller_payout_ngn)}. Open your chat to review the exchange terms.`, `offer:accepted:${id}`);
    return json({ ok: true, conversationId, orderId: orders[0]?.id, message: "Offer accepted. Both of you can now review the exchange terms in your conversation." });
  } catch (error) { return errorResponse(error); }
}
