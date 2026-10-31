import { BackendError, adminFetch, errorResponse, getAuthContext, json } from "@/lib/server/backend";
import { assertUuid } from "@/lib/server/security";
import { assertSameOrigin } from "@/lib/server/security";
import { deleteStorageObject } from "@/lib/server/storage";
import { notifyUser } from "@/lib/server/mailer";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    assertUuid(id);
    const rows = await adminFetch<Array<Record<string, unknown> & { id: string; seller: { display_name: string; verification_status: string }; photo_paths: string[] }>>(
      `rest/v1/listings?id=eq.${id}&status=eq.active&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,seller_id,title,description,category,condition,price_ngn,negotiable,meetup_area,photo_paths,created_at,expires_at,seller:profiles!listings_seller_id_fkey(display_name,verification_status)`,
    );
    const listing = rows[0];
    if (!listing) throw new BackendError("This listing has expired or is no longer available.", 404);
    const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
    return json({ listing: { ...listing, price: listing.price_ngn, originalPrice: listing.price_ngn, location: listing.meetup_area, sellerName: listing.seller?.display_name || "FUTA student", sellerVerified: listing.seller?.verification_status === "approved", imageUrls: (listing.photo_paths ?? []).map((path) => `${base}/storage/v1/object/public/listing-images/${path.split("/").map(encodeURIComponent).join("/")}`) } });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const auth = await getAuthContext();
    if (!auth) throw new BackendError("Sign in to remove a listing.", 401);
    const { id } = await params;
    assertUuid(id);
    const rows = await adminFetch<Array<{ id: string; seller_id: string; title: string; status: string; photo_paths: string[] }>>(`rest/v1/listings?id=eq.${id}&select=id,seller_id,title,status,photo_paths`);
    const listing = rows[0];
    if (!listing || (listing.seller_id !== auth.user.id && auth.profile.role !== "admin")) throw new BackendError("Listing not found.", 404);
    if (auth.profile.role !== "admin" && listing.status !== "active") throw new BackendError("Only active listings can be removed by the seller.", 409);
    const pendingOffers = await adminFetch<Array<{ id: string; buyer_id: string }>>(`rest/v1/offers?listing_id=eq.${id}&status=eq.pending&select=id,buyer_id`);
    if (pendingOffers.length) {
      await adminFetch(`rest/v1/offers?listing_id=eq.${id}&status=eq.pending`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "withdrawn", responded_at: new Date().toISOString() }) });
      await Promise.all(pendingOffers.map((offer) => notifyUser(offer.buyer_id, "A D_clutr listing was removed", "The seller removed an item you made an offer on. The offer is no longer active.", `offer-withdrawn:${offer.id}`)));
    }
    for (const path of listing.photo_paths ?? []) await deleteStorageObject("listing-images", path);
    await adminFetch(`rest/v1/listings?id=eq.${id}`, { method: "DELETE" });
    if (listing.seller_id !== auth.user.id) await notifyUser(listing.seller_id, "A D_clutr listing was removed", `“${listing.title}” was removed from the FUTA marketplace by an administrator. Contact support if you believe this was a mistake.`, `listing-removed:${id}`);
    return json({ ok: true, message: "The listing and its photos were removed from the active database and storage." });
  } catch (error) { return errorResponse(error); }
}
