import { createHash, randomInt } from "node:crypto";
import { BackendError, adminFetch, errorResponse, getAuthContext, json, userFetch } from "@/lib/server/backend";
import { assertSameOrigin, assertUuid } from "@/lib/server/security";
import { notifyAdmin, notifyOrderParticipants, notifyUser } from "@/lib/server/mailer";

function hashCode(code: string) { return createHash("sha256").update(code).digest("hex"); }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to generate a delivery code.", 401);
    const { id } = await params;
    assertUuid(id);
    const rows = await userFetch<Array<{ id: string; buyer_id: string; status: string }>>(`rest/v1/orders?id=eq.${id}&select=id,buyer_id,status`, auth.session);
    const order = rows[0];
    if (!order || order.buyer_id !== auth.user.id) throw new BackendError("Order not found.", 404);
    if (order.status !== "dispatched") throw new BackendError("A delivery code is available after the seller records dispatch.", 409);
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await adminFetch(`rest/v1/orders?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ delivery_code_hash: hashCode(code), delivery_code_attempts: 0 }) });
    const sellerRows = await userFetch<Array<{ seller_id: string }>>(`rest/v1/orders?id=eq.${id}&select=seller_id`, auth.session);
    if (sellerRows[0]) await notifyUser(sellerRows[0].seller_id, "Delivery confirmation is ready", "The buyer generated a delivery code. Ask them for it only after handing over the item and then enter it in the D_clutr conversation.", `delivery-code:${id}:${Date.now()}`);
    return json({ ok: true, code, message: "Share this code with the seller only after the item is safely delivered. It is shown once; generate a new one if needed." });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to confirm delivery.", 401);
    const { id } = await params;
    assertUuid(id);
    const { code } = await request.json() as { code?: string };
    if (!/^\d{6}$/.test(code ?? "")) throw new BackendError("Enter the buyer’s six-digit delivery code.");
    const normalizedCode = code ?? "";
    const rows = await userFetch<Array<{ id: string; seller_id: string; status: string }>>(`rest/v1/orders?id=eq.${id}&select=id,seller_id,status`, auth.session);
    const order = rows[0];
    if (!order || order.seller_id !== auth.user.id) throw new BackendError("Order not found.", 404);
    if (order.status !== "dispatched") throw new BackendError("This order is not awaiting delivery confirmation.", 409);
    const valid = await userFetch<boolean>("rest/v1/rpc/verify_delivery_code", auth.session, { method: "POST", body: JSON.stringify({ p_order_id: id, p_code_hash: hashCode(normalizedCode), p_actor_id: auth.user.id }) });
    if (!valid) throw new BackendError("That code is not valid. Confirm it with the buyer. Five attempts are allowed; the buyer can generate a new code.", 400);
    const deliveredAt = new Date().toISOString();
    const dueRows = await userFetch<string>("rest/v1/rpc/next_business_day", auth.session, { method: "POST", body: JSON.stringify({ p_from: deliveredAt }) });
    await adminFetch(`rest/v1/orders?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "delivered", delivered_at: deliveredAt, payout_due_at: dueRows, delivery_code_hash: null, delivery_code_attempts: 0 }) });
    const participants = await userFetch<Array<{ buyer_id: string; seller_id: string; seller_payout_ngn: number }>>(`rest/v1/orders?id=eq.${id}&select=buyer_id,seller_id,seller_payout_ngn`, auth.session);
    if (participants[0]) await notifyOrderParticipants(participants[0].buyer_id, participants[0].seller_id, "Delivery confirmed on D_clutr", `Delivery was confirmed. The seller's net payout is ${new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(participants[0].seller_payout_ngn)} after the 5% seller fee. It becomes due after one business day; the D_clutr admin records the manual transfer.`, `delivery-confirmed:${id}`);
    if (participants[0]) await notifyAdmin("D_clutr seller payout scheduled", `Delivery for order ${id} is confirmed. Seller payout of NGN ${participants[0].seller_payout_ngn} becomes due after one business day. Sign in to the admin dashboard when it is due.`, `payout-due:${id}`);
    return json({ ok: true, payoutDueAt: dueRows, message: "Delivery confirmed. D_clutr admin will review the seller payout after one business day." });
  } catch (error) { return errorResponse(error); }
}
