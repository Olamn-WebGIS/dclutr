import { BackendError, adminFetch, errorResponse, getAuthContext, json } from "@/lib/server/backend";

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to view your activity.", 401);
    const rows = await adminFetch<Array<{ unread_messages: number; pending_offers: number; checkout_orders: number }>>(
      "rest/v1/rpc/header_activity_counts",
      { method: "POST", body: JSON.stringify({ p_user_id: auth.user.id }) },
    );
    return json({ counts: rows[0] ?? { unread_messages: 0, pending_offers: 0, checkout_orders: 0 } });
  } catch (error) { return errorResponse(error); }
}