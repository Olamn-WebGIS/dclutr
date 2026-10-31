import { BackendError, adminFetch, errorResponse, getAuthContext, json, userFetch } from "@/lib/server/backend";
import { assertSameOrigin, assertUuid } from "@/lib/server/security";
import { notifyUser, notifyOrderParticipants } from "@/lib/server/mailer";
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
    const rows = await adminFetch<Array<{ id: string }>>("rest/v1/offers?select=id", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ listing_id: id, listing_title_snapshot: listing.title, listing_seller_id: listing.seller_id, buyer_id: auth.user.id, amount_ngn: amount, note: body.note?.trim() || null }) });
    await notifyUser(listing.seller_id, "New offer on your D_clutr listing", `A student offered ${formatNaira(amount)} for “${listing.title}”. Sign in to review and accept or decline the offer.`, `offer:new:${rows[0]?.id}:seller`);
    return json({ ok: true, offerId: rows[0]?.id, message: "Offer sent to the seller." }, 201);
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to continue.", 401);
    const { id } = await params;
    assertUuid(id);
    const result = await userFetch<string>("rest/v1/rpc/start_fixed_price_purchase", auth.session, { method: "POST", body: JSON.stringify({ p_listing_id: id, p_actor_id: auth.user.id }) });
    const orders = await adminFetch<Array<{ id: string; buyer_id: string; seller_id: string; amount_ngn: number; buyer_fee_ngn: number; seller_fee_ngn: number }>>(`rest/v1/orders?conversation_id=eq.${result}&select=id,buyer_id,seller_id,amount_ngn,buyer_fee_ngn,seller_fee_ngn`);
    const order = orders[0];
    if (order) await notifyOrderParticipants(order.buyer_id, order.seller_id, "D_clutr purchase request", `A student started a purchase conversation. Item price: ${formatNaira(order.amount_ngn)}. Buyer fee (2%): ${formatNaira(order.buyer_fee_ngn)}. Seller fee (5%): ${formatNaira(order.seller_fee_ngn)}. Review the item and both accept the exchange terms before payment.`, `order:created:${order.id}`);
    return json({ ok: true, conversationId: result, message: "The seller conversation is open. Review and accept the exchange terms together." }, 201);
  } catch (error) { return errorResponse(error); }
}
