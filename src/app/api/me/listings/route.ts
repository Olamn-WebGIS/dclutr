import { BackendError, errorResponse, getAuthContext, json, userFetch, adminFetch } from "@/lib/server/backend";
import { assertUuid } from "@/lib/server/security";
import { purgeExpiredListings } from "@/lib/server/listing-cleanup";

export async function GET(request: Request) {
  try {
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to view your listings.", 401);
    await purgeExpiredListings();
    const relistId = new URL(request.url).searchParams.get("relist");
    if (relistId) {
      assertUuid(relistId);
      const current = new Date().toISOString();
      const rows = await adminFetch<Array<{ id: string; title: string; description: string; category: string; condition: string; price_ngn: number; negotiable: boolean; meetup_area: string; expires_at: string }>>(
        `rest/v1/listings?id=eq.${relistId}&seller_id=eq.${auth.user.id}&status=eq.active&expires_at=gt.${encodeURIComponent(current)}&select=id,title,description,category,condition,price_ngn,negotiable,meetup_area,expires_at&limit=1`,
      );
      if (!rows[0]) throw new BackendError("This listing has expired or is no longer available to relist.", 404);
      return json({ listing: rows[0] });
    }
    const listings = await userFetch<Array<{ id: string; title: string; price_ngn: number; status: string; expires_at: string; created_at: string; negotiable: boolean }>>(`rest/v1/listings?seller_id=eq.${auth.user.id}&select=id,title,price_ngn,status,expires_at,created_at,negotiable&order=created_at.desc`, auth.session);
    return json({ listings });
  } catch (error) { return errorResponse(error); }
}
