import type { Metadata } from "next";
import { adminFetch } from "@/lib/server/backend";
import { formatNaira } from "@/lib/currency";

type ShareListing = {
  title: string;
  condition: string;
  price_ngn: number;
  seller: { verification_status: string } | null;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug)) {
    return { title: "Item not found | D_clutr" };
  }
  const rows = await adminFetch<ShareListing[]>(
    `rest/v1/listings?id=eq.${slug}&status=in.(active,sold)&select=title,condition,price_ngn,seller:profiles!listings_seller_id_fkey(verification_status)`,
  );
  const listing = rows[0];
  if (!listing) return { title: "Item not found | D_clutr" };

  const title = `${listing.title} — ${formatNaira(listing.price_ngn)} | D_clutr`;
  const description = `${formatNaira(listing.price_ngn)} · ${listing.condition}${listing.seller?.verification_status === "approved" ? " · Verified FUTA seller" : ""}. View this item on D_clutr in Akure.`;
  return {
    title,
    description,
    openGraph: { type: "website", title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function ProductLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
