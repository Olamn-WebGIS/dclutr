import { adminFetch, errorResponse, json, requireAdmin } from "@/lib/server/backend";
import { decryptPrivateValue } from "@/lib/server/secrets";

export async function GET() {
  try {
    await requireAdmin();
    const now = encodeURIComponent(new Date().toISOString());
    const [profiles, activeListings, verifications, openDisputes, payoutQueue, orders] = await Promise.all([
      adminFetch<Array<{ id: string }>>("rest/v1/profiles?select=id"),
      adminFetch<Array<{ id: string }>>(`rest/v1/listings?status=eq.active&expires_at=gt.${now}&select=id`),
      adminFetch<Array<{ id: string }>>("rest/v1/verification_submissions?status=eq.pending&select=id"),
      adminFetch<Array<{ id: string }>>("rest/v1/disputes?status=in.(open,under_review)&select=id"),
      adminFetch<Array<{ id: string; seller_id: string; amount_ngn: number; seller_fee_ngn: number; seller_payout_ngn: number; payout_due_at: string }>>(`rest/v1/orders?status=eq.delivered&payout_due_at=lte.${now}&select=id,seller_id,amount_ngn,seller_fee_ngn,seller_payout_ngn,payout_due_at`),
      adminFetch<Array<{ id: string; amount_ngn: number; buyer_fee_ngn: number; seller_fee_ngn: number; status: string }>>("rest/v1/orders?select=id,amount_ngn,buyer_fee_ngn,seller_fee_ngn,status&limit=10000"),
    ]);
    const paidOrders = orders.filter((order) => ["paid", "dispatched", "delivered", "completed", "disputed"].includes(order.status));
    const payouts = await Promise.all(payoutQueue.map(async (order) => {
      const profiles = await adminFetch<Array<{ display_name: string; email: string }>>(`rest/v1/profiles?id=eq.${order.seller_id}&select=display_name,email`);
      const bankRows = await adminFetch<Array<{ encrypted_details: string; account_last4: string }>>(`rest/v1/seller_payout_profiles?user_id=eq.${order.seller_id}&select=encrypted_details,account_last4`);
      const bank = bankRows[0] ? JSON.parse(decryptPrivateValue(bankRows[0].encrypted_details)) as { bankName: string; accountName: string; accountNumber: string } : null;
      return { ...order, sellerName: profiles[0]?.display_name ?? "Student", sellerEmail: profiles[0]?.email ?? "", payoutDetails: bank };
    }));
    return json({ stats: { students: profiles.length, activeListings: activeListings.length, pendingVerifications: verifications.length, openDisputes: openDisputes.length, payoutsDue: payoutQueue.length, paidOrders: paidOrders.length, grossNgn: paidOrders.reduce((sum, order) => sum + order.amount_ngn, 0), platformFeesNgn: paidOrders.reduce((sum, order) => sum + order.buyer_fee_ngn + order.seller_fee_ngn, 0) }, payouts });
  } catch (error) { return errorResponse(error); }
}
