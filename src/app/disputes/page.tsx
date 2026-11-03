"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHead, PageShell } from "@/components/page-shell";
import { formatNaira } from "@/lib/currency";
import { formatMarketplaceStatus } from "@/lib/marketplace-copy";

type Order = { id: string; listing_id: string; amount_ngn: number; status: string };
type Dispute = { id: string; order_id: string; reason: string; status: string; admin_response: string | null; listingTitle: string };

export default function DisputesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    const [orderResponse, disputeResponse] = await Promise.all([fetch("/api/orders"), fetch("/api/disputes")]);
    const orderData = await orderResponse.json(); const disputeData = await disputeResponse.json();
    if (!orderResponse.ok) throw new Error(orderData.error || "Log in to get help with an order.");
    if (!disputeResponse.ok) throw new Error(disputeData.error || "We couldn’t load your disputes. Please try again.");
    setOrders(orderData.orders.filter((order: Order) => ["paid", "dispatched", "delivered"].includes(order.status)));
    setDisputes(disputeData.disputes);
    const requested = new URLSearchParams(window.location.search).get("order");
    if (requested) setOrderId(requested);
  }
  useEffect(() => { load().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "We couldn’t load your disputes. Please try again.")); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try { const response = await fetch("/api/disputes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId, reason }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "We couldn’t send your report. Please try again."); setReason(""); setMessage(data.message); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "We couldn’t send your report. Please try again."); }
    finally { setBusy(false); }
  }
  return <PageShell><PageHead eyebrow="ORDER SUPPORT" title="Need help with an order?" description="Tell our team what happened. Please stick to the facts, and don’t include your password, verification codes, or card details." />{message && <div className="status-note" role="status">{message}</div>}<form className="content-card" onSubmit={submit}><h2>Tell us what went wrong</h2><div className="field"><label htmlFor="order">Choose an order</label><select id="order" value={orderId} onChange={(event) => setOrderId(event.target.value)} required><option value="">Select an order</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.id.slice(0, 8)} · {formatNaira(order.amount_ngn)} · {formatMarketplaceStatus(order.status)}</option>)}</select></div><div className="field"><label htmlFor="reason">What happened?</label><textarea id="reason" required minLength={10} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Tell us what happened and how you’d like us to help…" /></div><button className="button button-dark" disabled={busy || !orderId}>{busy ? "Sending…" : "Send your report"}</button></form><section className="content-card"><h2>Your reports</h2>{disputes.length ? disputes.map((dispute) => <article className="offer-card" key={dispute.id}><h3>{dispute.listingTitle} · {formatMarketplaceStatus(dispute.status)}</h3><p>{dispute.reason}</p>{dispute.admin_response && <div className="notice"><strong>Our team’s reply</strong><p>{dispute.admin_response}</p></div>}</article>) : <p className="condition-note">You haven’t reported an issue yet.</p>}</section></PageShell>;
}
