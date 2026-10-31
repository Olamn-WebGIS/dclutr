import { BackendError, errorResponse, getAuthContext, json, userFetch } from "@/lib/server/backend";
import { purgeExpiredListings } from "@/lib/server/listing-cleanup";

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to view your listings.", 401);
    await purgeExpiredListings();
    const listings = await userFetch<Array<{ id: string; title: string; price_ngn: number; status: string; expires_at: string; created_at: string; negotiable: boolean }>>(`rest/v1/listings?seller_id=eq.${auth.user.id}&select=id,title,price_ngn,status,expires_at,created_at,negotiable&order=created_at.desc`, auth.session);
    return json({ listings });
  } catch (error) { return errorResponse(error); }
}
