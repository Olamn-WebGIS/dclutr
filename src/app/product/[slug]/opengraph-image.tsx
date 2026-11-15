import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { adminFetch } from "@/lib/server/backend";

export const alt = "FUTA marketplace item with price and condition";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type ShareListing = {
  title: string;
  condition: string;
  price_ngn: number;
  photo_paths: string[];
  seller: { verification_status: string } | null;
};

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug)) notFound();

  const rows = await adminFetch<ShareListing[]>(
    `rest/v1/listings?id=eq.${slug}&status=in.(active,sold)&select=title,condition,price_ngn,photo_paths,seller:profiles!listings_seller_id_fkey(verification_status)`,
  );
  const listing = rows[0];
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const photoPath = listing?.photo_paths[0];
  if (!listing || !base || !photoPath) notFound();

  const imageUrl = `${base}/storage/v1/object/public/listing-images/${photoPath.split("/").map(encodeURIComponent).join("/")}`;
  const price = `NGN ${listing.price_ngn.toLocaleString("en-NG")}`;
  const verified = listing.seller?.verification_status === "approved";

  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#f8f7f1", color: "#203a2e", padding: 28 }}>
      <div style={{ position: "relative", display: "flex", width: 574, height: 574, overflow: "hidden", borderRadius: 16, background: "#e3eadf" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={listing.title} width={574} height={574} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", top: 20, left: 20, display: "flex", padding: "8px 12px", borderRadius: 6, background: "#fffefa", color: "#203a2e", fontSize: 19, fontWeight: 600 }}>{listing.condition}</div>
        {verified && <div style={{ position: "absolute", top: 20, right: 20, display: "flex", padding: "8px 12px", borderRadius: 6, background: "#486b50", color: "#fffefa", fontSize: 17, fontWeight: 700 }}>Verified FUTA seller</div>}
        <div style={{ position: "absolute", right: 20, bottom: 20, display: "flex", padding: "10px 14px", borderRadius: 8, background: "#203a2e", color: "#fffefa", fontSize: 30, fontWeight: 700 }}>{price}</div>
      </div>
      <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", padding: "36px 40px" }}>
        <div style={{ display: "flex", color: "#486b50", fontSize: 22, fontWeight: 700, letterSpacing: 4 }}>D_CLUTR · FUTA, AKURE</div>
        <div style={{ display: "flex", marginTop: 32, fontSize: 48, fontWeight: 700, lineHeight: 1.15, overflow: "hidden" }}>{listing.title.slice(0, 68)}</div>
        <div style={{ display: "flex", marginTop: 24, color: "#526258", fontSize: 25 }}>Find it on D_clutr</div>
        <div style={{ display: "flex", marginTop: 52, color: "#486b50", fontSize: 20, fontWeight: 600 }}>Buy and sell with FUTA students</div>
      </div>
    </div>,
    { ...size },
  );
}
