"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHead, PageShell } from "@/components/page-shell";
import { formatNaira } from "@/lib/currency";
import { formatMarketplaceStatus } from "@/lib/marketplace-copy";

type Offer = { id: string; listing_id: string | null; listingTitle: string; amount_ngn: number; note: string | null; status: string; created_at: string };

export default function OffersPage() {
  const [received, setReceived] = useState<Offer[]>([]);
  const [sent, setSent] = useState<Offer[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  async function load() {
    const response = await fetch("/api/offers"); const result = await response.json();
    if (!response.ok) throw new Error(result.error || "We couldn’t load your offers. Please try again.");
    setReceived(result.received); setSent(result.sent);
  }
  useEffect(() => { load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "We couldn’t load your offers. Please try again.")); }, []);
  async function respond(id: string, decision: "accept" | "reject") {
    setBusy(id); setError("");
    try { const response = await fetch(`/api/offers/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); await load(); if (result.conversationId) window.location.href = `/chat?conversation=${result.conversationId}`; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t update this offer. Please try again."); }
    finally { setBusy(""); }
  }
  return <PageShell><PageHead eyebrow="BUYING AND SELLING AT FUTA" title="Your offers." description="Make an offer to start a chat. If the seller accepts, you can agree on the item and meetup details together." />{error && <div className="status-note error">{error}</div>}<div className="content-card"><h2>Offers for your items</h2>{received.length ? received.map((offer) => <article className="offer-card" key={offer.id}><h3>{offer.listingTitle}</h3><strong>{formatNaira(offer.amount_ngn)}</strong>{offer.note && <p>{offer.note}</p>}<p>{formatMarketplaceStatus(offer.status)}</p>{offer.status === "pending" && offer.listing_id && <div className="offer-actions"><button className="button button-dark" disabled={busy === offer.id} onClick={() => respond(offer.id, "accept")}>Accept and chat</button><button className="outline-button" disabled={busy === offer.id} onClick={() => respond(offer.id, "reject")}>Decline</button></div>}</article>) : <p className="condition-note">No offers yet. Offers on your items will show up here.</p>}</div><div className="content-card"><h2>Offers you’ve made</h2>{sent.length ? sent.map((offer) => <article className="offer-card" key={offer.id}><h3>{offer.listing_id ? <Link href={`/product/${offer.listing_id}`}>{offer.listingTitle}</Link> : offer.listingTitle}</h3><strong>{formatNaira(offer.amount_ngn)}</strong><p>{formatMarketplaceStatus(offer.status)}{offer.status === "accepted" && " · Open your messages to agree on the details."}</p></article>) : <p className="condition-note">You haven’t made an offer yet. Browse D_clutr items to get started.</p>}<Link className="text-link" href="/market">Browse D_clutr items →</Link></div></PageShell>;
}
