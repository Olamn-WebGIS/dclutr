"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, Heart, MapPin, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import type { Product } from "@/data/products";
import { formatNaira } from "@/lib/currency";

type Listing = Product & { description: string; imageUrls: string[]; sellerName: string; sellerId: string; meetup_area?: string; status: string; myOffer: { status: string; amount_ngn: number } | null; offerAttempts: number };

export default function ProductPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/listings/${params.slug}`).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We can’t find this item right now.");
      const row = result.listing;
      setProduct({ ...row, myOffer: row.myOffer ?? null, offerAttempts: row.offerAttempts ?? 0, name: row.title, price: row.price_ngn, originalPrice: row.price_ngn, location: row.meetup_area, seller: row.sellerName, initials: row.sellerName.split(/\s+/).map((part: string) => part[0]).join("").slice(0, 2).toUpperCase(), color: "sage", icon: "◉" });
      if (row.myOffer?.status === "pending") setOffer(String(row.myOffer.amount_ngn));
    }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "We couldn’t load this item. Please try again.")).finally(() => setLoading(false));
  }, [params.slug]);

  async function startExchange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(product.negotiable ? `/api/listings/${product.id}/offers` : `/api/listings/${product.id}/offers`, {
        method: product.negotiable ? "POST" : "PUT",
        headers: product.negotiable ? { "content-type": "application/json" } : undefined,
        body: product.negotiable ? JSON.stringify({ amount: Number(offer) }) : undefined,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We couldn’t start this chat. Please try again.");
      if (product.negotiable) {
        setMessage(result.message);
        setProduct((current) => current ? { ...current, myOffer: { status: "pending", amount_ngn: Number(offer) }, offerAttempts: current.offerAttempts + (result.wasUpdated ? 0 : 1) } : current);
      }
      else router.push(`/chat?conversation=${result.conversationId}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "We couldn’t start this chat. Please try again."); }
    finally { setBusy(false); }
  }

  const canRetryOffer = product?.myOffer?.status === "rejected" && product.offerAttempts < 3;
  const offerLocked = Boolean(product?.myOffer && product.myOffer.status !== "pending" && !canRetryOffer);
  if (loading) return <PageShell><div className="status-note">Loading item…</div></PageShell>;
  if (!product) return <PageShell><div className="status-note error">{message || "This item is no longer available."}</div><Link className="text-link" href="/market"><ArrowLeft size={15} /> Back to D_clutr items</Link></PageShell>;
  return <PageShell>
    <div style={{ paddingTop: 27 }}><Link className="text-link" href="/market"><ArrowLeft size={15} /> Back to D_clutr items</Link></div>
    <div className="detail-layout"><div className={`detail-art tone-${product.color}`}>
      {product.imageUrls?.[0] ? <img src={product.imageUrls[0]} alt={product.name} className="product-photo" /> : <span className="product-glyph" aria-hidden="true">{product.icon}</span>}
      <span className={product.status === "sold" ? "sold-out-tag" : "product-tag"}>{product.status === "sold" ? "Sold out" : product.condition}</span>
    </div><div className="detail-copy"><span className="eyebrow">{product.category.toUpperCase()}</span><h1>{product.name}</h1><div className="detail-price">{formatNaira(product.price)}</div>{product.negotiable && product.status !== "sold" && <span className="verified-inline">Price is negotiable</span>}<p>{product.description}</p><div className="seller-row"><span className="seller-avatar">{product.initials}</span><span className="seller-info"><strong>{product.sellerName} {product.sellerVerified && <span className="student-badge"><BadgeCheck size={14} /> Verified FUTA seller</span>}</strong><small>Student seller · {product.condition}</small></span></div><div style={{ display: "flex", gap: 7, alignItems: "center", color: "#758075", fontSize: 11 }}><MapPin size={14} /> {product.location} · Agree a safe local meetup</div>
      {product.status === "sold" ? <div className="notice" role="status">This item is sold out. You can no longer make an offer or start a purchase.</div> : <form className="offer-actions" onSubmit={startExchange}>{product.negotiable && offerLocked && <div className="notice" role="status">{product.myOffer?.status === "accepted" ? "Your offer was accepted; you can no longer send another offer on this item." : product.myOffer?.status === "rejected" ? "You have used all 3 offer attempts for this item." : "This offer can no longer be changed."}</div>}{product.negotiable && canRetryOffer && <div className="notice" role="status">Your last offer was declined. You can send another offer ({product.offerAttempts} of 3 attempts used).</div>}{product.negotiable && <div className="field" style={{ width: "100%" }}><label htmlFor="offer-price">Your offer (₦)</label><input id="offer-price" type="number" min="1" max={product.price} required value={offer} onChange={(event) => setOffer(event.target.value)} placeholder={String(product.price)} disabled={offerLocked} /><span className="condition-note">{product.myOffer?.status === "pending" ? "Update your offer while it is still pending." : "You can make up to 3 offers on this item."}</span></div>}<button className="button button-dark" type="submit" disabled={busy || offerLocked}>{busy ? "Please wait…" : product.negotiable ? product.myOffer?.status === "pending" ? "Update offer" : canRetryOffer ? "Send another offer" : "Send offer" : "Message seller to buy"}</button><Link className="outline-button" href="/offers"><Heart size={15} /> My offers</Link></form>}
      {message && <div className="notice" role="status">{message}</div>}
      <div className="info-box"><ShieldCheck size={15} style={{ verticalAlign: "middle", marginRight: 7 }} />Meet somewhere busy and public, and check the item before confirming handover. Pay through D_clutr after you and the seller agree on the details.</div>
    </div></div>
  </PageShell>;
}
