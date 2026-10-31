import { BackendError, adminFetch, errorResponse, json, requireAdmin } from "@/lib/server/backend";
import { assertSameOrigin, assertUuid } from "@/lib/server/security";
import { notifyOrderParticipants } from "@/lib/server/mailer";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const auth = await requireAdmin();
    const { id } = await params;
    assertUuid(id);
    const { decision, response } = await request.json() as { decision?: string; response?: string };
    if (!["resolved_buyer", "resolved_seller", "under_review"].includes(decision ?? "") || !response || response.trim().length < 10 || response.trim().length > 2000) throw new BackendError("Choose a resolution and provide a clear response (10–2000 characters).");
    const rows = await adminFetch<Array<{ id: string; order_id: string; status: string }>>(`rest/v1/disputes?id=eq.${id}&select=id,order_id,status`);
    const dispute = rows[0];
    if (!dispute || !["open", "under_review"].includes(dispute.status)) throw new BackendError("This dispute is not open for review.", 404);
    const resolved = decision !== "under_review";
    await adminFetch(`rest/v1/disputes?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: decision, admin_response: response.trim(), resolved_by: resolved ? auth.user.id : null, resolved_at: resolved ? new Date().toISOString() : null }) });
    const orders = await adminFetch<Array<{ buyer_id: string; seller_id: string; dispatched_at: string | null; delivered_at: string | null }>>(`rest/v1/orders?id=eq.${dispute.order_id}&select=buyer_id,seller_id,dispatched_at,delivered_at`);
    const order = orders[0];
    if (resolved) {
      const restoredOrderStatus = decision === "resolved_buyer" ? "cancelled" : order?.delivered_at ? "delivered" : order?.dispatched_at ? "dispatched" : "paid";
      await adminFetch(`rest/v1/orders?id=eq.${dispute.order_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: restoredOrderStatus }) });
      if (order) {
        for (const userId of [order.buyer_id, order.seller_id]) await adminFetch("rest/v1/notifications", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ user_id: userId, kind: "dispute_resolution", title: "Dispute reviewed", body: response.trim() }) });
        await notifyOrderParticipants(order.buyer_id, order.seller_id, "D_clutr dispute reviewed", response.trim(), `dispute-resolution:${id}`);
      }
    }
    return json({ ok: true, message: "Dispute review saved." });
  } catch (error) { return errorResponse(error); }
}
