import { createHmac, timingSafeEqual } from "node:crypto";
import { adminFetch, BackendError, errorResponse, json, requireEnv } from "@/lib/server/backend";
import { notifyOrderParticipants } from "@/lib/server/mailer";
import { formatNaira } from "@/lib/currency";

export async function POST(request: Request) {
  try {
    const secret = requireEnv("PAYSTACK_SECRET_KEY");
    const signature = request.headers.get("x-paystack-signature");
    const raw = await request.text();
    const expected = createHmac("sha512", secret).update(raw).digest("hex");
    if (!signature || !/^[a-f0-9]{128}$/i.test(signature) || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))) throw new BackendError("Invalid payment webhook signature.", 401);
    const event = JSON.parse(raw) as { event?: string; data?: { status?: string; reference?: string; amount?: number; currency?: string } };
    if (event.event !== "charge.success" || event.data?.status !== "success" || !event.data.reference) return json({ received: true });
    const orders = await adminFetch<Array<{ id: string; buyer_id: string; seller_id: string; amount_ngn: number; buyer_fee_ngn: number; buyer_total_ngn: number; status: string; paystack_reference: string }>>(`rest/v1/orders?paystack_reference=eq.${encodeURIComponent(event.data.reference)}&select=id,buyer_id,seller_id,amount_ngn,buyer_fee_ngn,buyer_total_ngn,status,paystack_reference`);
    const order = orders[0];
    if (!order) throw new BackendError("No order matches this payment reference.", 404);
    if (event.data.currency !== "NGN" || event.data.amount !== order.buyer_total_ngn * 100) throw new BackendError("Payment amount or currency does not match the order.", 400);
    if (order.status === "paid" || order.status === "dispatched" || order.status === "delivered" || order.status === "completed") return json({ received: true });
    if (order.status !== "awaiting_payment") throw new BackendError("Order cannot accept payment in its current state.", 409);
    await adminFetch(`rest/v1/orders?id=eq.${order.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "paid", paid_at: new Date().toISOString() }) });
    await notifyOrderParticipants(order.buyer_id, order.seller_id, "D_clutr payment confirmed", `We’ve confirmed payment for your order. Item amount: ${formatNaira(order.amount_ngn)}. Buyer fee (2%): ${formatNaira(order.buyer_fee_ngn)}. Total paid: ${formatNaira(order.buyer_total_ngn)}. The seller can now arrange handover in your D_clutr chat.`, `payment-confirmed:${order.id}`);
    return json({ received: true });
  } catch (error) { return errorResponse(error); }
}
