import { BackendError, errorResponse, getAuthContext, json, userFetch } from "@/lib/server/backend";
import { assertSameOrigin, assertUuid } from "@/lib/server/security";
import { notifyOrderParticipants } from "@/lib/server/mailer";
import { sendPushToUser } from "@/lib/server/push-notifications";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to accept the exchange terms.", 401);
    const { id } = await params;
    assertUuid(id);
    const status = await userFetch<string>("rest/v1/rpc/accept_order_terms", auth.session, { method: "POST", body: JSON.stringify({ p_order_id: id, p_actor_id: auth.user.id }) });
    const orders = await userFetch<Array<{ buyer_id: string; seller_id: string; conversation_id: string }>>(`rest/v1/orders?id=eq.${id}&select=buyer_id,seller_id,conversation_id`, auth.session);
    if (orders[0]) {
      const recipient = auth.user.id === orders[0].buyer_id ? orders[0].seller_id : orders[0].buyer_id;
      const message = status === "awaiting_payment"
        ? "You both accepted the exchange terms. The buyer can now pay securely through D_clutr."
        : "The other person accepted the exchange terms. Open your chat to review and accept.";
      await notifyOrderParticipants(orders[0].buyer_id, orders[0].seller_id, "Exchange terms updated on D_clutr", status === "awaiting_payment" ? "You both accepted the exchange terms. The buyer can now pay securely through D_clutr. We’ll confirm when the payment goes through." : "One of you accepted the exchange terms. The order will be ready for payment once you both agree.", `terms:${id}:${status}:${auth.user.id}`);
      await sendPushToUser(recipient, {
        title: status === "awaiting_payment" ? "Exchange terms accepted" : "Exchange terms updated",
        body: message,
        url: `/chat?conversation=${orders[0].conversation_id}`,
        tag: `terms-${id}`,
      });
    }
    return json({ ok: true, status, message: status === "awaiting_payment" ? "Both parties accepted. The buyer can now pay through D_clutr." : "Your acceptance is saved. Waiting for the other person." });
  } catch (error) { return errorResponse(error); }
}
