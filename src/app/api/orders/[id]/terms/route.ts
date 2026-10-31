import { BackendError, errorResponse, getAuthContext, json, userFetch } from "@/lib/server/backend";
import { assertSameOrigin, assertUuid } from "@/lib/server/security";
import { notifyOrderParticipants } from "@/lib/server/mailer";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to accept the exchange terms.", 401);
    const { id } = await params;
    assertUuid(id);
    const status = await userFetch<string>("rest/v1/rpc/accept_order_terms", auth.session, { method: "POST", body: JSON.stringify({ p_order_id: id, p_actor_id: auth.user.id }) });
    const orders = await userFetch<Array<{ buyer_id: string; seller_id: string }>>(`rest/v1/orders?id=eq.${id}&select=buyer_id,seller_id`, auth.session);
    if (orders[0]) await notifyOrderParticipants(orders[0].buyer_id, orders[0].seller_id, "Exchange terms updated on D_clutr", status === "awaiting_payment" ? "Both students accepted the exchange terms. The buyer can now pay through D_clutr’s Paystack checkout." : "One participant accepted the exchange terms. The order will be ready for payment after both students agree.", `terms:${id}:${status}:${auth.user.id}`);
    return json({ ok: true, status, message: status === "awaiting_payment" ? "Both parties accepted. The buyer can now pay through D_clutr." : "Your acceptance is saved. Waiting for the other person." });
  } catch (error) { return errorResponse(error); }
}
