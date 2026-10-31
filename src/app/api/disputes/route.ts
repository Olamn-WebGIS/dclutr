import { BackendError, adminFetch, errorResponse, getAuthContext, json, userFetch } from "@/lib/server/backend";
import { assertSameOrigin, assertUuid } from "@/lib/server/security";
import { notifyAdmin, notifyOrderParticipants } from "@/lib/server/mailer";

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to view disputes.", 401);
    const isAdmin = auth.profile.role === "admin";
    const rows = await adminFetch<Array<Record<string, unknown> & { id: string; order_id: string; opened_by: string }>>("rest/v1/disputes?select=*&order=created_at.desc");
    const enriched = await Promise.all(rows.map(async (dispute) => {
      const orders = await adminFetch<Array<{ listing_id: string | null; item_title: string; buyer_id: string; seller_id: string; amount_ngn: number }>>(`rest/v1/orders?id=eq.${dispute.order_id}&select=listing_id,item_title,buyer_id,seller_id,amount_ngn`);
      const listing = orders[0]?.listing_id ? await adminFetch<Array<{ title: string }>>(`rest/v1/listings?id=eq.${orders[0].listing_id}&select=title`) : [];
      return { ...dispute, listingTitle: listing[0]?.title ?? orders[0]?.item_title ?? "Order", order: orders[0] };
    }));
    return json({ disputes: isAdmin ? enriched : enriched.filter((dispute) => dispute.opened_by === auth.user.id || dispute.order?.buyer_id === auth.user.id || dispute.order?.seller_id === auth.user.id) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to open a dispute.", 401);
    const { orderId, reason } = await request.json() as { orderId?: string; reason?: string };
    if (!orderId || !reason || reason.trim().length < 10 || reason.trim().length > 2000) throw new BackendError("Provide the order and explain the issue in at least 10 characters.");
    assertUuid(orderId);
    const orders = await userFetch<Array<{ id: string; buyer_id: string; seller_id: string; status: string }>>(`rest/v1/orders?id=eq.${orderId}&select=id,buyer_id,seller_id,status`, auth.session);
    const order = orders[0];
    if (!order || ![order.buyer_id, order.seller_id].includes(auth.user.id)) throw new BackendError("Order not found.", 404);
    if (!["paid", "dispatched", "delivered"].includes(order.status)) throw new BackendError("A dispute can be opened after payment and before an order is completed.", 409);
    const existing = await adminFetch<Array<{ id: string }>>(`rest/v1/disputes?order_id=eq.${orderId}&select=id`);
    if (existing.length) throw new BackendError("A dispute is already open for this order.", 409);
    await adminFetch("rest/v1/disputes", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ order_id: orderId, opened_by: auth.user.id, reason: reason.trim() }) });
    await adminFetch(`rest/v1/orders?id=eq.${orderId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "disputed" }) });
    await notifyOrderParticipants(order.buyer_id, order.seller_id, "A D_clutr order dispute was opened", "A participant opened a dispute. The payout is paused while an administrator reviews the order. Sign in to D_clutr for the case status.", `dispute-open:${orderId}`);
    await notifyAdmin("D_clutr dispute needs review", `A dispute was opened for order ${orderId}. Sign in to the admin dashboard to review it.`, `admin-dispute:${orderId}`);
    await adminFetch("rest/v1/notifications", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ user_id: auth.user.id === order.buyer_id ? order.seller_id : order.buyer_id, kind: "dispute", title: "A dispute was opened", body: "An order needs admin review. Open your D_clutr dashboard for details." }) });
    return json({ ok: true, message: "Dispute submitted for admin review." }, 201);
  } catch (error) { return errorResponse(error); }
}
