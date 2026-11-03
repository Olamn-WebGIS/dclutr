import { BackendError, adminFetch, errorResponse, getAuthContext, json, requireEnv, userFetch } from "@/lib/server/backend";
import { assertSameOrigin, assertUuid } from "@/lib/server/security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in before making payment.", 401);
    const { orderId } = await request.json() as { orderId?: string };
    if (!orderId) throw new BackendError("Order reference is required.");
    assertUuid(orderId);
    const rows = await userFetch<Array<{ id: string; buyer_id: string; buyer_total_ngn: number; status: string; buyer_terms_accepted_at: string | null; seller_terms_accepted_at: string | null }>>(`rest/v1/orders?id=eq.${orderId}&select=id,buyer_id,buyer_total_ngn,status,buyer_terms_accepted_at,seller_terms_accepted_at`, auth.session);
    const order = rows[0];
    if (!order || order.buyer_id !== auth.user.id) throw new BackendError("Order not found.", 404);
    if (order.status !== "awaiting_payment" || !order.buyer_terms_accepted_at || !order.seller_terms_accepted_at) throw new BackendError("Both parties must accept the terms before payment.", 409);
    const secret = requireEnv("PAYSTACK_SECRET_KEY");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const reference = `dcl-${order.id}-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
    await adminFetch(`rest/v1/orders?id=eq.${order.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ paystack_reference: reference }) });
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST", headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ email: auth.user.email, amount: order.buyer_total_ngn * 100, currency: "NGN", reference, callback_url: `${appUrl}/api/payments/callback`, metadata: { order_id: order.id, buyer_id: auth.user.id } }), cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok || !result.status || !result.data?.authorization_url) throw new BackendError("We couldn’t start your payment. Please try again in a bit.", 502);
    return json({ authorizationUrl: result.data.authorization_url });
  } catch (error) { return errorResponse(error); }
}
