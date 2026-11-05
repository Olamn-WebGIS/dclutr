import { BackendError, adminFetch, errorResponse, getAuthContext, json, userFetch } from "@/lib/server/backend";
import { assertSameOrigin, assertUuid } from "@/lib/server/security";
import { notifyUser, notifyOrderParticipantsByRole } from "@/lib/server/mailer";
import { formatNaira } from "@/lib/currency";
import { checkRateLimit } from "@/lib/server/password-auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to make an offer.", 401);
    const { id } = await params;
    assertUuid(id);
    if (!await checkRateLimit(`offer:${auth.user.id}:${id}`, request, 5, 3600)) throw new BackendError("You have sent several offers for this item. Try again later.", 429);
    const body = await request.json() as { amount?: number; note?: string };
    const amount = Number(body.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0 || (body.note?.length ?? 0) > 500) throw new BackendError("Enter a valid offer amount and a note under 500 characters.");
    const listings = await adminFetch<Array<{ id: string; title: string; seller_id: string; price_ngn: number; negotiable: boolean; status: string; expires_at: string }>>(`rest/v1/listings?id=eq.${id}&select=id,title,seller_id,price_ngn,negotiable,status,expires_at`);
    const listing = listings[0];
    if (!listing || listing.status !== "active" || new Date(listing.expires_at) <= new Date()) throw new BackendError("This listing is no longer available.", 404);
    if (listing.seller_id === auth.user.id) throw new BackendError("You cannot make an offer on your own listing.");
    if (!listing.negotiable) throw new BackendError("The seller has not enabled offers for this item.");
    if (amount > listing.price_ngn) throw new BackendError("An offer cannot exceed the asking price.");
    const rows = await adminFetch<Array<{ offer_id: string; was_updated: boolean }>>("rest/v1/rpc/submit_listing_offer", {
      method: "POST",
      body: JSON.stringify({ p_listing_id: id, p_actor_id: auth.user.id, p_amount_ngn: amount, p_note: body.note?.trim() || null }),
    });
    const offer = rows[0];
    if (offer?.was_updated) {
      await notifyUser(listing.seller_id, "A D_clutr offer was updated", `A student updated their offer to ${formatNaira(amount)} for “${listing.title}”. Sign in to review it.`, `offer:updated:${offer.offer_id}:${amount}`);
    } else {
      await notifyUser(listing.seller_id, "New offer on your D_clutr listing", `A student offered ${formatNaira(amount)} for “${listing.title}”. Sign in to review and accept or decline the offer.`, `offer:new:${offer?.offer_id}:seller`);
    }
    return json({ ok: true, offerId: offer?.offer_id, wasUpdated: offer?.was_updated ?? false, message: offer?.was_updated ? "Your pending offer was updated." : "Offer sent to the seller." }, offer?.was_updated ? 200 : 201);
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to continue.", 401);
    const { id } = await params;
    assertUuid(id);
    const conversationPath = `rest/v1/conversations?listing_id=eq.${id}&buyer_id=eq.${auth.user.id}&select=id&limit=1`;
    const existing = await adminFetch<Array<{ id: string }>>(conversationPath);
    let result = existing[0]?.id;
    let createdConversation = false;
    let reopenedOrder = false;
    if (result) {
      const currentOrders = await adminFetch<Array<{ status: string }>>(`rest/v1/orders?conversation_id=eq.${result}&select=status&limit=1`);
      if (currentOrders[0]?.status === "cancelled") {
        result = await userFetch<string>("rest/v1/rpc/start_fixed_price_purchase", auth.session, { method: "POST", body: JSON.stringify({ p_listing_id: id, p_actor_id: auth.user.id }) });
        reopenedOrder = true;
      }
    } else {
      try {
        result = await userFetch<string>("rest/v1/rpc/start_fixed_price_purchase", auth.session, { method: "POST", body: JSON.stringify({ p_listing_id: id, p_actor_id: auth.user.id }) });
        createdConversation = true;
      } catch (error) {
        if (!(error instanceof BackendError) || !error.message.includes("conversations_listing_id_buyer_id_key")) throw error;
        const concurrent = await adminFetch<Array<{ id: string }>>(conversationPath);
        if (!concurrent[0]) throw new BackendError("A chat for this item already exists. Open your messages to continue.", 409);
        result = concurrent[0].id;
      }
    }
    const orders = await adminFetch<Array<{ id: string; buyer_id: string; seller_id: string; amount_ngn: number; buyer_fee_ngn: number; seller_fee_ngn: number; buyer_total_ngn: number; seller_payout_ngn: number }>>(`rest/v1/orders?conversation_id=eq.${result}&select=id,buyer_id,seller_id,amount_ngn,buyer_fee_ngn,seller_fee_ngn,buyer_total_ngn,seller_payout_ngn`);
    const order = orders[0];
    if ((createdConversation || reopenedOrder) && order) await notifyOrderParticipantsByRole(order.buyer_id, order.seller_id, "D_clutr purchase request", `The item price is ${formatNaira(order.amount_ngn)}. Your 2% buyer fee is ${formatNaira(order.buyer_fee_ngn)}, bringing your total to ${formatNaira(order.buyer_total_ngn)}. Review the item and agree on the exchange terms with the seller. Once you both agree, you will pay the total through D_clutr.`, `The item price is ${formatNaira(order.amount_ngn)}. D_clutr's 5% seller fee of ${formatNaira(order.seller_fee_ngn)} will be deducted from the sale, leaving an estimated payout of ${formatNaira(order.seller_payout_ngn)}. Open your D_clutr chat to review the purchase request. The buyer is responsible for paying through D_clutr; you do not need to make a payment.`, `order:created:${order.id}:${Date.now()}`);
    return json({ ok: true, conversationId: result, message: createdConversation ? "The seller conversation is open. Review and accept the exchange terms together." : reopenedOrder ? "The cancelled order is open again in this chat." : "You already have a chat for this item. Opening it now." }, createdConversation || reopenedOrder ? 201 : 200);
  } catch (error) { return errorResponse(error); }
}
