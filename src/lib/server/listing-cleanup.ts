import "server-only";
import { adminFetch } from "@/lib/server/backend";
import { deleteStorageObject } from "@/lib/server/storage";
import { notifyUser } from "@/lib/server/mailer";

export async function purgeExpiredListings() {
  await adminFetch("rest/v1/rpc/expire_old_listings", { method: "POST" });
  const expired = await adminFetch<Array<{ id: string; seller_id: string; title: string; photo_paths: string[] }>>(
    "rest/v1/listings?status=eq.expired&select=id,seller_id,title,photo_paths&order=expires_at.asc&limit=100",
  );
  let purged = 0;
  for (const listing of expired) {
    const pendingOffers = await adminFetch<Array<{ id: string; buyer_id: string; amount_ngn: number }>>(
      `rest/v1/offers?listing_id=eq.${listing.id}&status=eq.pending&select=id,buyer_id,amount_ngn`,
    );
    if (pendingOffers.length) {
      await adminFetch(`rest/v1/offers?listing_id=eq.${listing.id}&status=eq.pending`, {
        method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "expired", responded_at: new Date().toISOString() }),
      });
      await Promise.all(pendingOffers.map((offer) => notifyUser(offer.buyer_id, "A D_clutr listing expired", `The listing “${listing.title}” expired before the seller responded to your offer. Browse the campus market for similar items.`, `offer-expired:${offer.id}`)));
    }
    try {
      for (const path of listing.photo_paths ?? []) await deleteStorageObject("listing-images", path);
    } catch (error) {
      console.error(`Keeping expired listing ${listing.id} until photo cleanup succeeds:`, error);
      continue;
    }
    await adminFetch(`rest/v1/listings?id=eq.${listing.id}&status=eq.expired`, { method: "DELETE" });
    purged++;
  }
  return { expiredFound: expired.length, purged };
}
