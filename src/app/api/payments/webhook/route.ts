import { createHmac, timingSafeEqual } from "node:crypto";
import { adminFetch, BackendError, errorResponse, json, requireEnv } from "@/lib/server/backend";
import { notifyAdmin, notifyOrderParticipants, notifyOrderParticipantsByRole } from "@/lib/server/mailer";
import { formatNaira } from "@/lib/currency";

type PaymentOrder = { id: string; buyer_id: string; seller_id: string; listing_id: string | null; amount_ngn: number; buyer_fee_ngn: number; seller_fee_ngn: number; buyer_total_ngn: number; seller_payout_ngn: number; status: string; paystack_reference: string };

async function reportPaymentAfterUnavailableItem(order: PaymentOrder, reason: "cancelled" | "sold_out") {
  const dedupeKey = `unavailable-item-payment:${order.id}:${order.paystack_reference}`;
  const afterCancellation = reason === "cancelled";
  const title = afterCancellation ? "Payment received for a cancelled D_clutr order" : "Payment received for an unavailable D_clutr item";
  const adminText = afterCancellation
    ? `A payment was confirmed for cancelled order ${order.id}. Total: ${formatNaira(order.buyer_total_ngn)}. Check the transaction and arrange any necessary refund. Do not mark the order paid or arrange handover.`
    : `A payment was confirmed for order ${order.id}, but its item was already sold out. Total: ${formatNaira(order.buyer_total_ngn)}. Check the transaction and arrange any necessary refund. Do not mark the order paid or arrange handover.`;
  const participantText = afterCancellation
    ? "We received payment after this order was cancelled. Please don’t arrange handover. Our team will review the payment and contact you about next steps."
    : "We received payment after this item had sold out. Please don’t arrange handover. Our team will review the payment and contact you about next steps.";
  await Promise.all([
    notifyAdmin(title, adminText, dedupeKey),
    notifyOrderParticipants(order.buyer_id, order.seller_id, "Payment needs review", participantText, dedupeKey),
  ]);
}

export async function POST(request: Request) {
  try {
    const secret = requireEnv("PAYSTACK_SECRET_KEY");
    const signature = request.headers.get("x-paystack-signature");
    const raw = await request.text();
    const expected = createHmac("sha512", secret).update(raw).digest("hex");
    if (!signature || !/^[a-f0-9]{128}$/i.test(signature) || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))) throw new BackendError("Invalid payment webhook signature.", 401);
    const event = JSON.parse(raw) as { event?: string; data?: { status?: string; reference?: string; amount?: number; currency?: string } };
    if (event.event !== "charge.success" || event.data?.status !== "success" || !event.data.reference) return json({ received: true });
    const orders = await adminFetch<PaymentOrder[]>(`rest/v1/orders?paystack_reference=eq.${encodeURIComponent(event.data.reference)}&select=id,buyer_id,seller_id,listing_id,amount_ngn,buyer_fee_ngn,seller_fee_ngn,buyer_total_ngn,seller_payout_ngn,status,paystack_reference`);
    const order = orders[0];
    if (!order) throw new BackendError("No order matches this payment reference.", 404);
    if (event.data.currency !== "NGN" || event.data.amount !== order.buyer_total_ngn * 100) throw new BackendError("Payment amount or currency does not match the order.", 400);
    if (order.status === "paid" || order.status === "dispatched" || order.status === "delivered" || order.status === "disputed" || order.status === "completed") return json({ received: true });
    const confirmation = await adminFetch<{ result: string }>("rest/v1/rpc/confirm_marketplace_payment", { method: "POST", body: JSON.stringify({ p_order_id: order.id, p_paystack_reference: event.data.reference }) });
    if (confirmation.result === "already_paid") {
      if (order.listing_id) await rejectPendingOffers(order.listing_id);
      return json({ received: true });
    }
    if (confirmation.result === "cancelled" || confirmation.result === "sold_out") {
      await reportPaymentAfterUnavailableItem(order, confirmation.result);
      return json({ received: true });
    }
    if (confirmation.result !== "confirmed") throw new BackendError("Order cannot accept payment in its current state.", 409);
    if (order.listing_id) await rejectPendingOffers(order.listing_id);
    await notifyOrderParticipantsByRole(order.buyer_id, order.seller_id, "D_clutr payment confirmed", `We’ve confirmed your payment of ${formatNaira(order.buyer_total_ngn)} for your D_clutr order. This includes the item price of ${formatNaira(order.amount_ngn)} and your 2% buyer fee of ${formatNaira(order.buyer_fee_ngn)}. The seller can now arrange handover in your D_clutr chat.`, `The buyer’s payment of ${formatNaira(order.buyer_total_ngn)} is confirmed through D_clutr. The item price is ${formatNaira(order.amount_ngn)}. D_clutr's 5% seller fee of ${formatNaira(order.seller_fee_ngn)} is deducted from the sale, leaving an estimated payout of ${formatNaira(order.seller_payout_ngn)}. The buyer has paid; you do not need to make a payment. Please arrange handover in the D_clutr chat.`, `payment-confirmed:${order.id}`);
    return json({ received: true });
  } catch (error) { return errorResponse(error); }
}

async function rejectPendingOffers(listingId: string) {
  await adminFetch(`rest/v1/offers?listing_id=eq.${listingId}&status=eq.pending`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "rejected", responded_at: new Date().toISOString() }) });
}
