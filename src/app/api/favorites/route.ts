import { BackendError, adminFetch, errorResponse, getAuthContext, json } from "@/lib/server/backend";
import { assertSameOrigin, assertUuid } from "@/lib/server/security";

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to view saved items.", 401);
    const rows = await adminFetch<Array<{ listing_id: string }>>(`rest/v1/favorites?user_id=eq.${auth.user.id}&select=listing_id&order=created_at.desc`);
    if (!rows.length) return json({ listingIds: [], listings: [] });
    const ids = rows.map((row) => row.listing_id);
    const listed = await adminFetch<Array<Record<string, unknown> & { id: string; seller: { display_name: string; verification_status: string }; photo_paths: string[] }>>(`rest/v1/listings?id=in.(${ids.join(",")})&status=eq.active&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,seller_id,title,description,category,condition,price_ngn,negotiable,meetup_area,photo_paths,seller:profiles!listings_seller_id_fkey(display_name,verification_status)`);
    const map = new Map(listed.map((row) => [row.id, { ...row, name: row.title, price: row.price_ngn, originalPrice: row.price_ngn, location: row.meetup_area, seller: row.seller?.display_name || "FUTA student", sellerVerified: row.seller?.verification_status === "approved", negotiable: row.negotiable, imageUrl: row.photo_paths?.[0] ? `${process.env.SUPABASE_URL?.replace(/\/$/, "")}/storage/v1/object/public/listing-images/${row.photo_paths[0].split("/").map(encodeURIComponent).join("/")}` : null, color: "sage", icon: "◉" }]));
    return json({ listingIds: ids, listings: ids.map((id) => map.get(id)).filter(Boolean) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to save items.", 401);
    const { listingId, saved } = await request.json() as { listingId?: string; saved?: boolean };
    if (!listingId || typeof saved !== "boolean") throw new BackendError("Listing and save state are required.");
    assertUuid(listingId);
    if (saved) {
      const listings = await adminFetch<Array<{ id: string }>>(`rest/v1/listings?id=eq.${listingId}&status=eq.active&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id`);
      if (!listings[0]) throw new BackendError("This listing is not available to save.", 404);
      await adminFetch("rest/v1/favorites", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ user_id: auth.user.id, listing_id: listingId }) });
    } else await adminFetch(`rest/v1/favorites?user_id=eq.${auth.user.id}&listing_id=eq.${listingId}`, { method: "DELETE" });
    return json({ ok: true, saved });
  } catch (error) { return errorResponse(error); }
}
