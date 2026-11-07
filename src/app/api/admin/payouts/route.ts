import { BackendError, adminFetch, errorResponse, json, requireAdmin, userFetch } from "@/lib/server/backend";
import { assertSameOrigin, assertUuid } from "@/lib/server/security";
import { notifyUser } from "@/lib/server/mailer";
import { recordMarketplaceEventSafely } from "@/lib/server/marketplace-analytics";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const auth = await requireAdmin();
    const { orderId, transferReference } = await request.json() as { orderId?: string; transferReference?: string };
    if (!orderId || !transferReference || transferReference.trim().length < 3 || transferReference.trim().length > 120) throw new BackendError("Enter an order and the actual bank transfer reference.");
    assertUuid(orderId);
    const orders = await adminFetch<Array<{ id: string; seller_id: string; seller_payout_ngn: number; payout_due_at: string; status: string }>>(`rest/v1/orders?id=eq.${orderId}&select=id,seller_id,seller_payout_ngn,payout_due_at,status`);
    const order = orders[0];
    if (!order || order.status !== "delivered" || !order.payout_due_at || new Date(order.payout_due_at) > new Date()) throw new BackendError("This seller payout is not due yet.", 409);
    await userFetch("rest/v1/rpc/admin_mark_payout_paid", auth.session, { method: "POST", body: JSON.stringify({ p_order_id: orderId, p_reference: transferReference.trim(), p_actor_id: auth.user.id }) });
    await recordMarketplaceEventSafely({ userId: order.seller_id, event: "order_completed", entityId: orderId });
    await adminFetch("rest/v1/notifications", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ user_id: order.seller_id, kind: "seller_payout", title: "Seller payout recorded", body: `Your net payout of NGN ${order.seller_payout_ngn} was marked as sent. Reference: ${transferReference.trim()}` }) });
    await notifyUser(order.seller_id, "D_clutr seller payout sent", `Your payout of NGN ${order.seller_payout_ngn} was recorded as sent. Transfer reference: ${transferReference.trim()}. Contact the D_clutr administrator if it does not arrive.`, `payout:${orderId}`);
    return json({ ok: true, message: "Payout recorded. Ensure the bank transfer was completed before marking it paid." });
  } catch (error) { return errorResponse(error); }
}
