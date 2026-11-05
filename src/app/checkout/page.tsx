"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHead, PageShell } from "@/components/page-shell";
import { formatNaira } from "@/lib/currency";
import { formatMarketplaceStatus } from "@/lib/marketplace-copy";
import { showToast } from "@/lib/notifications";

type Order = { id: string; conversation_id: string; amount_ngn: number; buyer_fee_ngn: number; seller_fee_ngn: number; buyer_total_ngn: number; seller_payout_ngn: number; status: string; buyer_id: string; listing: { status: string } | null };

export default function CheckoutPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState("Loading your orders…");
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState("");
  useEffect(() => {
    Promise.all([fetch("/api/orders"), fetch("/api/auth/me")]).then(async ([ordersResponse, meResponse]) => {
      const orderData = await ordersResponse.json(); const meData = await meResponse.json();
      if (!ordersResponse.ok) throw new Error(orderData.error || "Log in to see your orders.");
      if (!meResponse.ok) throw new Error(meData.error || "Log in to see your orders.");
      setOrders(orderData.orders); setUserId(meData.user.id); setMessage(orderData.orders.length ? "" : "No orders yet. When a seller accepts your offer, your order will show up here.");
    }).catch((error: unknown) => { setLoadFailed(true); setMessage(""); showToast(error instanceof Error ? error.message : "We couldn’t load your orders. Please try again.", "error"); });
  }, []);
  async function pay(orderId: string) {
    setBusy(orderId); setMessage("");
    try { const response = await fetch("/api/payments/initialize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "We couldn’t start your payment. Please try again."); window.location.assign(result.authorizationUrl); }
    catch (error) { showToast(error instanceof Error ? error.message : "We couldn’t start your payment. Please try again.", "error"); setBusy(""); }
  }
  return <PageShell><PageHead eyebrow="YOUR D_CLUTR ORDERS" title="Your orders." description="Check your payments and exchange updates here. You and the seller need to agree on the amount before you pay." />{message && <div className="status-note" role="status">{message}</div>}{orders.map((order) => <article className="offer-card" key={order.id}><h3>Order {order.id.slice(0, 8)} · {formatMarketplaceStatus(order.status)}</h3><p>{order.buyer_id === userId ? <>Item: {formatNaira(order.amount_ngn)} · Your 2% buyer fee: {formatNaira(order.buyer_fee_ngn)} · Total you pay: {formatNaira(order.buyer_total_ngn)}</> : <>Item: {formatNaira(order.amount_ngn)} · Your 5% seller fee: {formatNaira(order.seller_fee_ngn)} · Your estimated payout: {formatNaira(order.seller_payout_ngn)}</>}</p>{order.status === "awaiting_payment" && order.listing?.status !== "active" && <p className="condition-note">This item is no longer available. You can’t pay for it; open the chat to cancel this exchange.</p>}<div className="order-toolbar"><Link className="outline-button" href={`/chat?conversation=${order.conversation_id}`}>View this chat</Link>{order.status === "awaiting_payment" && order.listing?.status === "active" && order.buyer_id === userId && <button className="button button-dark" disabled={busy === order.id} onClick={() => pay(order.id)}>{busy === order.id ? "Opening secure payment…" : `Pay ${formatNaira(order.buyer_total_ngn)} securely`}</button>}</div></article>)}{!orders.length && !loadFailed && <Link className="button button-dark" href="/market">Browse D_clutr items</Link>}</PageShell>;
}
