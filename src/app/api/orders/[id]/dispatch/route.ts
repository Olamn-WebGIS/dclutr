import { BackendError, adminFetch, errorResponse, getAuthContext, json, userFetch } from "@/lib/server/backend";
import { assertSameOrigin, assertUuid } from "@/lib/server/security";
import { notifyOrderParticipants } from "@/lib/server/mailer";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to update delivery.", 401);
    const { id } = await params;
    assertUuid(id);
    const rows = await userFetch<Array<{ id: string; seller_id: string; status: string }>>(`rest/v1/orders?id=eq.${id}&select=id,seller_id,status`, auth.session);
    const order = rows[0];
    if (!order || order.seller_id !== auth.user.id) throw new BackendError("Order not found.", 404);
    if (order.status !== "paid") throw new BackendError("The order must be paid before dispatch can be recorded.", 409);
    await adminFetch(`rest/v1/orders?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "dispatched", dispatched_at: new Date().toISOString() }) });
    const participants = await userFetch<Array<{ buyer_id: string; seller_id: string }>>(`rest/v1/orders?id=eq.${id}&select=buyer_id,seller_id`, auth.session);
    if (participants[0]) await notifyOrderParticipants(participants[0].buyer_id, participants[0].seller_id, "A D_clutr item has been dispatched", "The seller recorded dispatch. After the item arrives and you inspect it, the buyer should generate the six-digit delivery confirmation code in the conversation.", `dispatch:${id}`);
    return json({ ok: true, message: "Dispatch recorded. The buyer can now generate a one-time delivery confirmation code." });
  } catch (error) { return errorResponse(error); }
}
