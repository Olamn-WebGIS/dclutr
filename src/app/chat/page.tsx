"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Send, ShieldCheck } from "lucide-react";
import { PageHead, PageShell } from "@/components/page-shell";
import { formatNaira } from "@/lib/currency";
import { formatMarketplaceStatus } from "@/lib/marketplace-copy";
import { showToast } from "@/lib/notifications";

type Conversation = { id: string; listingTitle: string; otherName: string; role: "buyer" | "seller"; priceNgn: number; unreadCount: number };
type Message = { id: string; body: string; senderName: string; mine: boolean; created_at: string };
type Order = {
  id: string;
  conversation_id: string;
  listing_id: string | null;
  amount_ngn: number;
  buyer_fee_ngn: number;
  seller_fee_ngn: number;
  buyer_total_ngn: number;
  seller_payout_ngn: number;
  status: string;
  listing: { status: string; negotiable: boolean; price_ngn: number } | null;
  offer: { status: string; amount_ngn: number } | null;
  buyer_terms_accepted_at: string | null;
  seller_terms_accepted_at: string | null;
  paid_at: string | null;
  payout_due_at: string | null;
};

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [inboxStatus, setInboxStatus] = useState<"loading" | "ready" | "error">("loading");
  const [inboxError, setInboxError] = useState("");
  const [activeId, setActiveId] = useState("");
  const [showConversation, setShowConversation] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [draft, setDraft] = useState("");
  const [retryOfferAmount, setRetryOfferAmount] = useState("");
  const [deliveryCode, setDeliveryCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [busy, setBusy] = useState(false);

  const loadConversations = useCallback(async () => {
    setInboxStatus("loading");
    setInboxError("");
    try {
      const response = await fetch("/api/conversations");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Log in to see your messages.");
      setConversations(data.conversations);
      setInboxStatus("ready");
      const requested = new URLSearchParams(window.location.search).get("conversation");
      const requestedConversation = data.conversations.find((item: Conversation) => item.id === requested);
      setActiveId((current) => current || requestedConversation?.id || data.conversations[0]?.id || "");
      if (requestedConversation) setShowConversation(true);
    } catch (cause) {
      setInboxStatus("error");
      setInboxError(cause instanceof Error ? cause.message : "We couldn’t load your inbox. Please try again.");
      throw cause;
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!activeId) return;
    if (window.matchMedia("(max-width: 650px)").matches && !showConversation) return;
    const [messageResponse, orderResponse] = await Promise.all([fetch(`/api/conversations/${activeId}/messages`), fetch("/api/orders")]);
    const messageData = await messageResponse.json();
    const orderData = await orderResponse.json();
    if (!messageResponse.ok) throw new Error(messageData.error || "We couldn’t load your messages. Please try again.");
    if (!orderResponse.ok) throw new Error(orderData.error || "We couldn’t load this order. Please try again.");
    setMessages(messageData.messages);
    setOrders(orderData.orders);
    setConversations((current) => current.map((conversation) => conversation.id === activeId ? { ...conversation, unreadCount: 0 } : conversation));
    window.dispatchEvent(new Event("dclutr:activity-change"));
  }, [activeId, showConversation]);

  useEffect(() => { loadConversations().catch((cause: unknown) => showToast(cause instanceof Error ? cause.message : "We couldn’t load your inbox. Please try again.", "error")); }, [loadConversations]);
  useEffect(() => {
    loadData().catch((cause: unknown) => showToast(cause instanceof Error ? cause.message : "We couldn’t load this chat. Please try again.", "error"));
    const timer = window.setInterval(() => { loadData().catch(() => undefined); }, 5000);
    return () => window.clearInterval(timer);
  }, [loadData]);
  useEffect(() => {
    document.body.classList.toggle("chat-conversation-open", showConversation);
    return () => document.body.classList.remove("chat-conversation-open");
  }, [showConversation]);

  const active = conversations.find((item) => item.id === activeId);
  const order = orders.find((item) => item.conversation_id === activeId);
  const pendingReoffer = order?.status === "cancelled" && order.offer?.status === "pending";
  const canShareDetails = Boolean(order && ["paid", "dispatched", "delivered", "completed"].includes(order.status));
  const isBuyer = active?.role === "buyer";
  const myTermsAccepted = order && (isBuyer ? order.buyer_terms_accepted_at : order.seller_terms_accepted_at);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || !activeId) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/conversations/${activeId}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: draft }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your message didn’t send. Please try again.");
      setDraft(""); await loadData();
    } catch (cause) { showToast(cause instanceof Error ? cause.message : "Your message didn’t send. Please try again.", "error"); }
    finally { setBusy(false); }
  }

  async function post(url: string, method = "POST", body?: unknown) {
    setBusy(true);
    try {
      const response = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We couldn’t update this order. Please try again.");
      if (result.code) setDeliveryCode(result.code);
      showToast(result.message || "Your update is saved.", "success"); await loadData();
    } catch (cause) { showToast(cause instanceof Error ? cause.message : "We couldn’t update this order. Please try again.", "error"); }
    finally { setBusy(false); }
  }

  async function pay() {
    if (!order) return;
    setBusy(true);
    try {
      const response = await fetch("/api/payments/initialize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: order.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We couldn’t start your payment. Please try again.");
      window.location.assign(result.authorizationUrl);
    } catch (cause) { showToast(cause instanceof Error ? cause.message : "We couldn’t start your payment. Please try again.", "error"); setBusy(false); }
  }

  return <PageShell>
    <div className="chat-page-head"><PageHead eyebrow="D_CLUTR CHATS" title="Messages." description="Talk through the item, price, and a safe meetup before you pay." /></div>
    {inboxStatus === "loading" ? <div className="status-note" role="status" aria-live="polite">Loading your chats…</div> : inboxStatus === "error" ? <div className="status-note error" role="alert"><p>{inboxError}</p><button className="outline-button" type="button" onClick={() => { void loadConversations().catch((cause: unknown) => showToast(cause instanceof Error ? cause.message : "We couldn’t load your inbox. Please try again.", "error")); }}>Try again</button></div> : !conversations.length ? <div className="content-card"><p>Your chats will show up here after a seller accepts your offer.</p><Link className="button button-dark" href="/offers">See my offers</Link></div> : <section className={`chat-layout${showConversation ? " is-conversation-open" : " is-list-open"}`} aria-label="Your conversations">
      <aside className="chat-sidebar"><h2>Your chats</h2>{conversations.map((conversation) => <button type="button" className="conversation" key={conversation.id} onClick={() => { setActiveId(conversation.id); setShowConversation(true); setDeliveryCode(""); setRetryOfferAmount(""); }} style={{ width: "100%", textAlign: "left", background: activeId === conversation.id ? "#edf1e9" : "transparent", border: 0, cursor: "pointer" }}><span className="seller-avatar">{conversation.otherName.slice(0, 2).toUpperCase()}</span><span className="conversation-details"><strong>{conversation.otherName}</strong><p>{conversation.listingTitle}</p></span>{conversation.unreadCount > 0 && <span className="chat-unread-badge" aria-label={`${conversation.unreadCount} unread messages`}>{conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}</span>}</button>)}</aside>
      <div className="chat-window">
        <div className="chat-top"><button className="chat-back-button" type="button" onClick={() => setShowConversation(false)} aria-label="Back to your chats"><ArrowLeft size={18} /></button><span>{active?.otherName} <span style={{ color: "#899187", fontWeight: 400 }}>· {active?.listingTitle}</span></span></div>
        {order && <div className="content-card chat-order-card" style={{ margin: 12, padding: 16 }}>
          <strong style={{ fontSize: 12 }}>Order update: {pendingReoffer ? "Waiting for seller response" : formatMarketplaceStatus(order.status)}</strong>
          {order.status === "cancelled" ? <p style={{ fontSize: 11, color: "#748075" }}>{pendingReoffer ? `A new offer of ${formatNaira(order.offer?.amount_ngn ?? order.amount_ngn)} is waiting for review.` : order.listing?.status === "active" ? `This exchange was cancelled. ${isBuyer ? "You can make a new offer here." : "The buyer can send a new offer here."}` : "This exchange was cancelled and the listing is no longer available."}</p> : isBuyer ? <p style={{ fontSize: 11, color: "#748075" }}>Item: {formatNaira(order.amount_ngn)} · Your 2% buyer fee: {formatNaira(order.buyer_fee_ngn)} · Total you pay: {formatNaira(order.buyer_total_ngn)}. You and the seller both need to agree before payment.</p> : <p style={{ fontSize: 11, color: "#748075" }}>Item: {formatNaira(order.amount_ngn)} · Your 5% seller fee: {formatNaira(order.seller_fee_ngn)} · Your estimated payout: {formatNaira(order.seller_payout_ngn)}. You and the buyer both need to agree before payment.</p>}
          <details className="info-box"><summary>How this exchange works</summary><p>Check the item and agree on its condition, price, and a busy public meetup in Akure. Once you both agree, the buyer pays securely through D_clutr. We’ll confirm the payment before the seller hands over the item. After you receive and inspect it, share the six-digit code with the seller to confirm handover. Our team sends seller payouts after one business day. An open dispute can pause a payout. D_clutr is not a licensed escrow service.</p></details>
          {order.status === "terms_pending" && order.listing?.status !== "active" && <p className="condition-note">This item is no longer available, so this exchange can’t continue.</p>}
          {order.status === "terms_pending" && order.listing?.status === "active" && <div className="offer-actions"><button className="button button-dark" disabled={busy || Boolean(myTermsAccepted)} onClick={() => post(`/api/orders/${order.id}/terms`)}>{myTermsAccepted ? "You accepted the terms" : "I agree to the exchange terms"}</button><span className="condition-note">Both buyer and seller must agree.</span></div>}
          {order.status === "awaiting_payment" && isBuyer && order.listing?.status === "active" && <button className="button button-dark" disabled={busy} onClick={pay}>Pay {formatNaira(order.buyer_total_ngn)} securely</button>}
          {order.status === "awaiting_payment" && order.listing?.status !== "active" && <p className="condition-note">This item has sold out, so this order can’t be paid. You can cancel this exchange below.</p>}
          {order.status === "awaiting_payment" && !isBuyer && order.listing?.status === "active" && <p className="condition-note">The buyer still needs to pay. We’ll update this chat when we confirm the payment.</p>}
          {order.status === "cancelled" && isBuyer && order.listing?.status === "active" && order.listing_id && (order.listing.negotiable ? <form className="offer-actions chat-retry-offer" onSubmit={(event) => { event.preventDefault(); void post(`/api/listings/${order.listing_id}/offers`, "POST", { amount: Number(retryOfferAmount || order.offer?.amount_ngn) }); }}>
            <div className="field"><label htmlFor="retry-offer-amount">{order.offer?.status === "pending" ? "Update your offer (₦)" : "New offer (₦)"}</label><input id="retry-offer-amount" type="number" min="1" max={order.listing.price_ngn} required value={retryOfferAmount || (order.offer?.status === "pending" ? String(order.offer.amount_ngn) : "")} onChange={(event) => setRetryOfferAmount(event.target.value)} placeholder={String(order.listing.price_ngn)} /></div>
            <button className="button button-dark" type="submit" disabled={busy}>{order.offer?.status === "pending" ? "Update offer in this chat" : "Send a new offer in this chat"}</button>
          </form> : <button className="button button-dark" disabled={busy} onClick={() => post(`/api/listings/${order.listing_id}/offers`, "PUT")}>Start a new purchase in this chat</button>)}
          {order.status === "paid" && !isBuyer && <button className="button button-dark" disabled={busy} onClick={() => post(`/api/orders/${order.id}/dispatch`)}>I’ve handed over the item</button>}
          {order.status === "paid" && isBuyer && <p className="condition-note">Payment is confirmed. The seller will update this chat after handing over the item.</p>}
          {order.status === "dispatched" && isBuyer && <div className="offer-card"><strong>Delivery confirmation</strong><p>After you receive and inspect the item, generate a one-time code and share it with the seller.</p>{deliveryCode ? <p style={{ fontSize: 24, letterSpacing: 5, fontWeight: 700 }}>{deliveryCode}</p> : <button className="button button-dark" disabled={busy} onClick={() => post(`/api/orders/${order.id}/delivery-code`)}>Generate 6-digit code</button>}</div>}
          {order.status === "dispatched" && !isBuyer && <form className="offer-card" onSubmit={(event) => { event.preventDefault(); void post(`/api/orders/${order.id}/delivery-code`, "PUT", { code: confirmCode }); setConfirmCode(""); }}><strong>Confirm delivery</strong><p>Ask the buyer for their code only after handing over the item.</p><div className="field"><label htmlFor="delivery-code">Buyer’s 6-digit code</label><input id="delivery-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={confirmCode} onChange={(event) => setConfirmCode(event.target.value)} /></div><button className="button button-dark" disabled={busy}>Confirm delivery</button></form>}
          {order.status === "delivered" && isBuyer && <p className="condition-note">Handover confirmed. Thanks for completing your D_clutr exchange.</p>}
          {order.status === "delivered" && !isBuyer && <p className="condition-note">Handover confirmed. Your payout of {formatNaira(order.seller_payout_ngn)} is due after one business day: {order.payout_due_at ? new Date(order.payout_due_at).toLocaleString("en-NG") : "waiting for our team"}.</p>}
          {["terms_pending", "awaiting_payment"].includes(order.status) && <button className="outline-button" disabled={busy} onClick={() => post(`/api/orders/${order.id}/cancel`)}>Cancel this exchange</button>}
          {["paid", "dispatched", "delivered"].includes(order.status) && <Link className="text-link" href={`/disputes?order=${order.id}`}>Open a dispute</Link>}
        </div>}
        <div className="chat-messages" aria-live="polite">{messages.map((message) => <div key={message.id} className={`bubble ${message.mine ? "mine" : ""}`}><small>{message.mine ? "You" : message.senderName} · {new Date(message.created_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}</small><br />{message.body}</div>)}</div>
        {canShareDetails && <div className="notice">Payment is confirmed. You can now share pickup details here. Keep the rest of your exchange on D_clutr.</div>}
        <form className="chat-compose" onSubmit={sendMessage}><textarea rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} aria-label="Write a message" placeholder={canShareDetails ? "Write a message about pickup or contact details" : "Message the seller (no phone numbers or bank details yet)"} maxLength={2000} /><button aria-label="Send message" type="submit" disabled={busy}><Send size={15} /></button></form>
          <p className="chat-safety-note" style={{ color: "#7b857a", fontSize: 10, padding: "0 14px 12px" }}><ShieldCheck size={13} style={{ verticalAlign: "middle" }} /> Keep messages here. For your safety, phone numbers and bank details are blocked until payment is confirmed. Chats are deleted after 30 days.</p>
      </div>
    </section>}
  </PageShell>;
}
