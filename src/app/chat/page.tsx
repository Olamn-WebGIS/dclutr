"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Send, ShieldCheck } from "lucide-react";
import { PageHead, PageShell } from "@/components/page-shell";
import { formatNaira } from "@/lib/currency";

type Conversation = { id: string; listingTitle: string; otherName: string; role: "buyer" | "seller"; priceNgn: number };
type Message = { id: string; body: string; senderName: string; mine: boolean; created_at: string };
type Order = {
  id: string;
  conversation_id: string;
  amount_ngn: number;
  buyer_fee_ngn: number;
  seller_fee_ngn: number;
  buyer_total_ngn: number;
  seller_payout_ngn: number;
  status: string;
  buyer_terms_accepted_at: string | null;
  seller_terms_accepted_at: string | null;
  paid_at: string | null;
  payout_due_at: string | null;
};

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [draft, setDraft] = useState("");
  const [deliveryCode, setDeliveryCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const loadConversations = useCallback(async () => {
    const response = await fetch("/api/conversations");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Sign in to view your messages.");
    setConversations(data.conversations);
    if (!activeId) {
      const requested = new URLSearchParams(window.location.search).get("conversation");
      setActiveId(data.conversations.find((item: Conversation) => item.id === requested)?.id || data.conversations[0]?.id || "");
    }
  }, [activeId]);

  const loadData = useCallback(async () => {
    if (!activeId) return;
    const [messageResponse, orderResponse] = await Promise.all([fetch(`/api/conversations/${activeId}/messages`), fetch("/api/orders")]);
    const messageData = await messageResponse.json();
    const orderData = await orderResponse.json();
    if (!messageResponse.ok) throw new Error(messageData.error || "Could not load messages.");
    if (!orderResponse.ok) throw new Error(orderData.error || "Could not load order details.");
    setMessages(messageData.messages);
    setOrders(orderData.orders);
  }, [activeId]);

  useEffect(() => { loadConversations().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load inbox.")); }, [loadConversations]);
  useEffect(() => {
    loadData().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load this conversation."));
    const timer = window.setInterval(() => { loadData().catch(() => undefined); }, 5000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  const active = conversations.find((item) => item.id === activeId);
  const order = orders.find((item) => item.conversation_id === activeId);
  const canShareDetails = Boolean(order && ["paid", "dispatched", "delivered", "completed"].includes(order.status));
  const isBuyer = active?.role === "buyer";
  const myTermsAccepted = order && (isBuyer ? order.buyer_terms_accepted_at : order.seller_terms_accepted_at);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || !activeId) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/conversations/${activeId}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: draft }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Message was not sent.");
      setDraft(""); await loadData();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Message was not sent."); }
    finally { setBusy(false); }
  }

  async function post(url: string, method = "POST", body?: unknown) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Request failed.");
      if (result.code) setDeliveryCode(result.code);
      setNotice(result.message || "Saved."); await loadData();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Request failed."); }
    finally { setBusy(false); }
  }

  async function pay() {
    if (!order) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/payments/initialize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: order.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Payment could not be started.");
      window.location.assign(result.authorizationUrl);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Payment could not be started."); setBusy(false); }
  }

  return <PageShell>
    <PageHead eyebrow="D_CLUTR STUDENT INBOX" title="Messages." description="Agree on item details, meetup arrangements, and the exchange terms before payment." />
    {error && <div className="status-note error" role="alert">{error}</div>}
    {notice && <div className="status-note" role="status">{notice}</div>}
    {!conversations.length ? <div className="content-card"><p>Your accepted offers and conversations will appear here.</p><Link className="button button-dark" href="/offers">View my offers</Link></div> : <section className="chat-layout" aria-label="Your conversations">
      <aside className="chat-sidebar"><h2>Your inbox</h2>{conversations.map((conversation) => <button type="button" className="conversation" key={conversation.id} onClick={() => { setActiveId(conversation.id); setDeliveryCode(""); }} style={{ width: "100%", textAlign: "left", background: activeId === conversation.id ? "#edf1e9" : "transparent", border: 0, cursor: "pointer" }}><span className="seller-avatar">{conversation.otherName.slice(0, 2).toUpperCase()}</span><span><strong>{conversation.otherName}</strong><p>{conversation.listingTitle}</p></span></button>)}</aside>
      <div className="chat-window">
        <div className="chat-top">{active?.otherName} <span style={{ color: "#899187", fontWeight: 400 }}>· {active?.listingTitle}</span></div>
        {order && <div className="content-card" style={{ margin: 12, padding: 16 }}>
          <strong style={{ fontSize: 12 }}>Exchange status: {order.status.replaceAll("_", " ")}</strong>
          <p style={{ fontSize: 11, color: "#748075" }}>Item price: {formatNaira(order.amount_ngn)} · Buyer platform fee (2%): {formatNaira(order.buyer_fee_ngn)} · Buyer total: {formatNaira(order.buyer_total_ngn)} · Seller fee (5%): {formatNaira(order.seller_fee_ngn)} · Seller payout: {formatNaira(order.seller_payout_ngn)}. Both participants should accept these terms before payment.</p>
          <details className="info-box"><summary>Read the exchange terms</summary><p>Confirm the listing, condition, amount, and a public meetup in Akure. After both accept, the buyer pays D_clutr through Paystack; payment is not released to the seller until delivery is confirmed. After the buyer checks the item and shares the six-digit code, the seller enters it here. The admin payout queue becomes eligible after one business day. A dispute can pause the payout. These terms require legal and payment-provider review before launch.</p></details>
          {order.status === "terms_pending" && <div className="offer-actions"><button className="button button-dark" disabled={busy || Boolean(myTermsAccepted)} onClick={() => post(`/api/orders/${order.id}/terms`)}>{myTermsAccepted ? "You accepted the terms" : "I agree to the exchange terms"}</button><span className="condition-note">Both buyer and seller must agree.</span></div>}
          {order.status === "awaiting_payment" && isBuyer && <button className="button button-dark" disabled={busy} onClick={pay}>Pay {formatNaira(order.buyer_total_ngn)} securely with Paystack</button>}
          {order.status === "awaiting_payment" && !isBuyer && <p className="condition-note">Waiting for the buyer to complete payment. We will update this status after Paystack confirms payment.</p>}
          {order.status === "paid" && !isBuyer && <button className="button button-dark" disabled={busy} onClick={() => post(`/api/orders/${order.id}/dispatch`)}>I have dispatched the item</button>}
          {order.status === "paid" && isBuyer && <p className="condition-note">Payment received by D_clutr. The seller will update this conversation after dispatch.</p>}
          {order.status === "dispatched" && isBuyer && <div className="offer-card"><strong>Delivery confirmation</strong><p>After you receive and inspect the item, generate a one-time code and share it with the seller.</p>{deliveryCode ? <p style={{ fontSize: 24, letterSpacing: 5, fontWeight: 700 }}>{deliveryCode}</p> : <button className="button button-dark" disabled={busy} onClick={() => post(`/api/orders/${order.id}/delivery-code`)}>Generate 6-digit code</button>}</div>}
          {order.status === "dispatched" && !isBuyer && <form className="offer-card" onSubmit={(event) => { event.preventDefault(); void post(`/api/orders/${order.id}/delivery-code`, "PUT", { code: confirmCode }); setConfirmCode(""); }}><strong>Confirm delivery</strong><p>Ask the buyer for their code only after handing over the item.</p><div className="field"><label htmlFor="delivery-code">Buyer’s 6-digit code</label><input id="delivery-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={confirmCode} onChange={(event) => setConfirmCode(event.target.value)} /></div><button className="button button-dark" disabled={busy}>Confirm delivery</button></form>}
          {order.status === "delivered" && <p className="condition-note">Delivery confirmed. Seller payout of {formatNaira(order.seller_payout_ngn)} is due after one business day: {order.payout_due_at ? new Date(order.payout_due_at).toLocaleString("en-NG") : "pending admin review"}.</p>}
          {["terms_pending", "awaiting_payment"].includes(order.status) && <button className="outline-button" disabled={busy} onClick={() => post(`/api/orders/${order.id}/cancel`)}>Cancel unpaid agreement</button>}
          {["paid", "dispatched", "delivered"].includes(order.status) && <Link className="text-link" href={`/disputes?order=${order.id}`}>Open a dispute</Link>}
        </div>}
        <div className="chat-messages" aria-live="polite">{messages.map((message) => <div key={message.id} className={`bubble ${message.mine ? "mine" : ""}`}><small>{message.mine ? "You" : message.senderName} · {new Date(message.created_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}</small><br />{message.body}</div>)}</div>
        {canShareDetails && <div className="notice">Payment is confirmed. You can now share hostel, address, or contact details in chat here, but keep the transaction on D_clutr.</div>}
        <form className="chat-compose" onSubmit={sendMessage}><input value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Write a message" placeholder={canShareDetails ? "Ask seller to share contact details, hostel, or pickup address here" : "Text only · no phone, bank details, or off-platform contacts"} maxLength={2000} /><button aria-label="Send message" type="submit" disabled={busy}><Send size={15} /></button></form>
        <p style={{ color: "#7b857a", fontSize: 10, padding: "0 14px 12px" }}><ShieldCheck size={13} style={{ verticalAlign: "middle" }} /> Text-only chat. Messages are automatically deleted after 30 days. Contact details and off-platform transaction attempts are blocked until payment is confirmed.</p>
      </div>
    </section>}
  </PageShell>;
}
