"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHead, PageShell } from "@/components/page-shell";
import { formatNaira } from "@/lib/currency";

type Offer = { id: string; listing_id: string | null; listingTitle: string; amount_ngn: number; note: string | null; status: string; created_at: string };

export default function OffersPage() {
  const [received, setReceived] = useState<Offer[]>([]);
  const [sent, setSent] = useState<Offer[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  async function load() {
    const response = await fetch("/api/offers"); const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to load your offers.");
    setReceived(result.received); setSent(result.sent);
  }
  useEffect(() => { load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load offers.")); }, []);
  async function respond(id: string, decision: "accept" | "reject") {
    setBusy(id); setError("");
    try { const response = await fetch(`/api/offers/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); await load(); if (result.conversationId) window.location.href = `/chat?conversation=${result.conversationId}`; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to respond to offer."); }
    finally { setBusy(""); }
  }
  return <PageShell><PageHead eyebrow="D_CLUTR BUYING & SELLING" title="Offers." description="Offers start the conversation. Once you accept one, you and the other student can review the terms together." />{error && <div className="status-note error">{error}</div>}<div className="content-card"><h2>Offers received</h2>{received.length ? received.map((offer) => <article className="offer-card" key={offer.id}><h3>{offer.listingTitle}</h3><strong>{formatNaira(offer.amount_ngn)}</strong>{offer.note && <p>{offer.note}</p>}<p>Status: {offer.status}</p>{offer.status === "pending" && offer.listing_id && <div className="offer-actions"><button className="button button-dark" disabled={busy === offer.id} onClick={() => respond(offer.id, "accept")}>Accept & start chat</button><button className="outline-button" disabled={busy === offer.id} onClick={() => respond(offer.id, "reject")}>Decline</button></div>}</article>) : <p className="condition-note">No offers received yet. Offers on your active listings will appear here.</p>}</div><div className="content-card"><h2>Offers you sent</h2>{sent.length ? sent.map((offer) => <article className="offer-card" key={offer.id}><h3>{offer.listing_id ? <Link href={`/product/${offer.listing_id}`}>{offer.listingTitle}</Link> : offer.listingTitle}</h3><strong>{formatNaira(offer.amount_ngn)}</strong><p>Status: {offer.status}{offer.status === "accepted" && " — open your messages to agree on terms."}</p></article>) : <p className="condition-note">You have not sent any offers yet.</p>}<Link className="text-link" href="/market">Browse campus listings →</Link></div></PageShell>;
}
