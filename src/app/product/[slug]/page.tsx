"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, Heart, MapPin, Share2, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import type { Product } from "@/data/products";
import { formatNaira } from "@/lib/currency";
import { showToast } from "@/lib/notifications";

type Listing = Product & { description: string; imageUrls: string[]; sellerName: string; sellerId: string; meetup_area?: string; status: string; myOffer: { status: string; amount_ngn: number } | null; offerAttempts: number };

export default function ProductPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    fetch(`/api/listings/${params.slug}`).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We can’t find this item right now.");
      const row = result.listing;
      setProduct({ ...row, myOffer: row.myOffer ?? null, offerAttempts: row.offerAttempts ?? 0, name: row.title, price: row.price_ngn, originalPrice: row.price_ngn, location: row.meetup_area, seller: row.sellerName, initials: row.sellerName.split(/\s+/).map((part: string) => part[0]).join("").slice(0, 2).toUpperCase(), color: "sage", icon: "◉" });
      setSelectedImageIndex(0);
      fetch("/api/price-alert-interests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: row.title, listingIds: [row.id] }),
      }).then(async (response) => {
        if (!response.ok && response.status !== 401) {
          const error = await response.json();
          console.error("Could not save this item as a lower-price alert interest:", error.error);
        }
      }).catch((error: unknown) => console.error("Could not save this item as a lower-price alert interest:", error));
      if (row.myOffer?.status === "pending") setOffer(String(row.myOffer.amount_ngn));
    }).catch((error: unknown) => showToast(error instanceof Error ? error.message : "We couldn’t load this item. Please try again.", "error")).finally(() => setLoading(false));
  }, [params.slug]);

  async function startExchange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product) return;
    setBusy(true);
    try {
      const response = await fetch(product.negotiable ? `/api/listings/${product.id}/offers` : `/api/listings/${product.id}/offers`, {
        method: product.negotiable ? "POST" : "PUT",
        headers: product.negotiable ? { "content-type": "application/json" } : undefined,
        body: product.negotiable ? JSON.stringify({ amount: Number(offer) }) : undefined,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We couldn’t start this chat. Please try again.");
      if (product.negotiable) {
        showToast(result.message, "success");
        setProduct((current) => current ? { ...current, myOffer: { status: "pending", amount_ngn: Number(offer) }, offerAttempts: current.offerAttempts + (result.wasUpdated ? 0 : 1) } : current);
      }
      else router.push(`/chat?conversation=${result.conversationId}`);
    } catch (error) { showToast(error instanceof Error ? error.message : "We couldn’t start this chat. Please try again.", "error"); }
    finally { setBusy(false); }
  }

  async function shareListing() {
    if (!product) return;
    const url = `${window.location.origin}/product/${product.id}`;
    try {
      if (navigator.share) await navigator.share({ title: product.name, text: `${product.name} on D_clutr`, url });
      else {
        await navigator.clipboard.writeText(url);
        showToast("Listing link copied. Share it with another FUTA student.", "success");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      showToast("Could not share this listing. Please copy the page link from your browser.", "error");
    }
  }

  const canRetryOffer = product?.myOffer?.status === "rejected" && product.offerAttempts < 3;
  const offerLocked = Boolean(product?.myOffer && product.myOffer.status !== "pending" && !canRetryOffer);
  if (loading) return <PageShell><div className="status-note">Loading item…</div></PageShell>;
  if (!product) return <PageShell><div className="empty-state"><p>This item is no longer available.</p><Link className="text-link" href="/market"><ArrowLeft size={15} /> Back to D_clutr items</Link></div></PageShell>;
  return <PageShell>
    <div style={{ paddingTop: 27 }}><Link className="text-link" href="/market"><ArrowLeft size={15} /> Back to D_clutr items</Link></div>
    <div className="detail-layout"><div className={`detail-art tone-${product.color}`}>
      {product.imageUrls?.length ? <>
        <Image src={product.imageUrls[selectedImageIndex] ?? product.imageUrls[0]} alt={`${product.name}, photo ${selectedImageIndex + 1}`} className="product-photo" width={1200} height={900} sizes="(max-width: 650px) calc(100vw - 36px), (max-width: 1100px) 55vw, 600px" priority />
        {product.imageUrls.length > 1 && <div className="detail-photo-thumbnails" role="group" aria-label="Listing photos">{product.imageUrls.map((imageUrl, index) => <button key={imageUrl} type="button" className={`detail-photo-thumbnail${selectedImageIndex === index ? " is-selected" : ""}`} aria-label={`Show photo ${index + 1}`} aria-pressed={selectedImageIndex === index} onClick={() => setSelectedImageIndex(index)}><Image src={imageUrl} alt="" width={100} height={100} sizes="52px" /></button>)}</div>}
      </> : <span className="product-glyph" aria-hidden="true">{product.icon}</span>}
      <span className={product.status === "sold" ? "sold-out-tag" : "product-tag"}>{product.status === "sold" ? "Sold out" : product.condition}</span>
    </div><div className="detail-copy"><span className="eyebrow">{product.category.toUpperCase()}</span><h1>{product.name}</h1><div className="detail-price">{formatNaira(product.price)}</div>{product.negotiable && product.status !== "sold" && <span className="verified-inline">Price is negotiable</span>}<p>{product.description}</p><div className="seller-row"><span className="seller-avatar">{product.initials}</span><span className="seller-info"><strong>{product.sellerName} {product.sellerVerified && <span className="student-badge"><BadgeCheck size={14} /> Verified FUTA seller</span>}</strong><small>Student seller · {product.condition}</small></span></div><div style={{ display: "flex", gap: 7, alignItems: "center", color: "#758075", fontSize: 11 }}><MapPin size={14} /> {product.location} · Agree a safe local meetup</div>
      {product.status === "sold" ? <div className="notice" role="status">This item is sold out. You can no longer make an offer or start a purchase.</div> : <form className="offer-actions" onSubmit={startExchange}>{product.negotiable && offerLocked && <div className="notice" role="status">{product.myOffer?.status === "accepted" ? "Your offer was accepted; you can no longer send another offer on this item." : product.myOffer?.status === "rejected" ? "You have used all 3 offer attempts for this item." : "This offer can no longer be changed."}</div>}{product.negotiable && canRetryOffer && <div className="notice" role="status">Your last offer was declined. You can send another offer ({product.offerAttempts} of 3 attempts used).</div>}{product.negotiable && <div className="field" style={{ width: "100%" }}><label htmlFor="offer-price">Your offer (₦)</label><input id="offer-price" type="number" min="1" max={product.price} required value={offer} onChange={(event) => setOffer(event.target.value)} placeholder={String(product.price)} disabled={offerLocked} /><span className="condition-note">{product.myOffer?.status === "pending" ? "Update your offer while it is still pending." : "You can make up to 3 offers on this item."}</span></div>}<button className="button button-dark" type="submit" disabled={busy || offerLocked}>{busy ? "Please wait…" : product.negotiable ? product.myOffer?.status === "pending" ? "Update offer" : canRetryOffer ? "Send another offer" : "Send offer" : "Message seller to buy"}</button><Link className="outline-button" href="/offers"><Heart size={15} /> My offers</Link></form>}
      <div className="offer-actions"><button type="button" className="outline-button" onClick={shareListing}><Share2 size={15} /> Share listing</button></div>
      <div className="info-box"><ShieldCheck size={15} style={{ verticalAlign: "middle", marginRight: 7 }} />Meet somewhere busy and public, and check the item before confirming handover. Pay through D_clutr after you and the seller agree on the details.</div>
    </div></div>
  </PageShell>;
}
