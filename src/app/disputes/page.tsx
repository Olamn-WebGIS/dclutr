"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHead, PageShell } from "@/components/page-shell";
import { formatNaira } from "@/lib/currency";

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
    if (!orderResponse.ok) throw new Error(orderData.error || "Please sign in.");
    if (!disputeResponse.ok) throw new Error(disputeData.error || "Unable to load disputes.");
    setOrders(orderData.orders.filter((order: Order) => ["paid", "dispatched", "delivered"].includes(order.status)));
    setDisputes(disputeData.disputes);
    const requested = new URLSearchParams(window.location.search).get("order");
    if (requested) setOrderId(requested);
  }
  useEffect(() => { load().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Unable to load disputes.")); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try { const response = await fetch("/api/disputes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId, reason }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not open dispute."); setReason(""); setMessage(data.message); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not open dispute."); }
    finally { setBusy(false); }
  }
  return <PageShell><PageHead eyebrow="D_CLUTR ORDER SUPPORT" title="Resolve an issue." description="Tell the admin what happened with an order. Keep messages factual and do not include passwords, verification codes, or payment card details." />{message && <div className="status-note" role="status">{message}</div>}<form className="content-card" onSubmit={submit}><h2>Open a dispute</h2><div className="field"><label htmlFor="order">Order</label><select id="order" value={orderId} onChange={(event) => setOrderId(event.target.value)} required><option value="">Choose an order</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.id.slice(0, 8)} · {formatNaira(order.amount_ngn)} · {order.status}</option>)}</select></div><div className="field"><label htmlFor="reason">What went wrong?</label><textarea id="reason" required minLength={10} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe the issue and what resolution you are requesting…" /></div><button className="button button-dark" disabled={busy || !orderId}>{busy ? "Sending…" : "Send to D_clutr admin"}</button></form><section className="content-card"><h2>Your disputes</h2>{disputes.length ? disputes.map((dispute) => <article className="offer-card" key={dispute.id}><h3>{dispute.listingTitle} · {dispute.status.replaceAll("_", " ")}</h3><p>{dispute.reason}</p>{dispute.admin_response && <div className="notice"><strong>Admin response</strong><p>{dispute.admin_response}</p></div>}</article>) : <p className="condition-note">No disputes to show.</p>}</section></PageShell>;
}
