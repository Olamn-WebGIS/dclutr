import { BackendError, adminFetch, errorResponse, getAuthContext, json, userFetch } from "@/lib/server/backend";
import { assertSameOrigin, assertUuid } from "@/lib/server/security";
import { notifyOrderParticipants } from "@/lib/server/mailer";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to cancel an unpaid agreement.", 401);
    const { id } = await params;
    assertUuid(id);
    const orders = await userFetch<Array<{ id: string; buyer_id: string; seller_id: string }>>(`rest/v1/orders?id=eq.${id}&select=id,buyer_id,seller_id`, auth.session);
    const order = orders[0];
    if (!order) throw new BackendError("Order not found.", 404);
    await userFetch("rest/v1/rpc/cancel_unpaid_order", auth.session, { method: "POST", body: JSON.stringify({ p_order_id: id, p_actor_id: auth.user.id }) });
    await notifyOrderParticipants(order.buyer_id, order.seller_id, "Unpaid D_clutr agreement cancelled", "The agreement was cancelled before payment was confirmed. The item may now be available again.", `order-cancelled:${id}`);
    const otherId = auth.user.id === order.buyer_id ? order.seller_id : order.buyer_id;
    await adminFetch("rest/v1/notifications", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ user_id: otherId, kind: "order_cancelled", title: "Unpaid agreement cancelled", body: "The other student cancelled before payment was confirmed. The item may become available again." }) });
    return json({ ok: true, message: "Unpaid agreement cancelled." });
  } catch (error) { return errorResponse(error); }
}
