"use client";

import { FormEvent, useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { PageHead, PageShell } from "@/components/page-shell";
import { formatNaira } from "@/lib/currency";

type Verification = { id: string; userId: string; submittedAt: string; displayName: string; email: string; studentIdUrl: string; selfieUrl: string };
type Dispute = { id: string; order_id: string; listingTitle: string; reason: string; status: string };
type Payout = { id: string; amount_ngn: number; seller_fee_ngn: number; seller_payout_ngn: number; payout_due_at: string; sellerName: string; sellerEmail: string; payoutDetails: { bankName: string; accountName: string; accountNumber: string } | null };

export function AdminDashboard() {
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [references, setReferences] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [allowed, setAllowed] = useState(false);

  async function load() {
    const [summaryResponse, verificationResponse, disputeResponse] = await Promise.all([fetch("/api/admin/summary"), fetch("/api/admin/verification"), fetch("/api/disputes")]);
    const summary = await summaryResponse.json(); const verifyData = await verificationResponse.json(); const disputeData = await disputeResponse.json();
    const failure = [summaryResponse, verificationResponse, disputeResponse].find((response) => !response.ok);
    if (failure) throw new Error(summary.error || verifyData.error || disputeData.error || "Admin access is required.");
    setAllowed(true); setStats(summary.stats); setPayouts(summary.payouts); setVerifications(verifyData.submissions); setDisputes(disputeData.disputes.filter((item: Dispute) => ["open", "under_review"].includes(item.status)));
  }
  useEffect(() => { load().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Unable to load the admin dashboard.")); }, []);

  async function review(id: string, decision: "approve" | "reject") {
    setBusy(id); setMessage("");
    try { const response = await fetch("/api/admin/verification", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, decision, reason: reasons[id] }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setMessage(result.message); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Review failed."); }
    finally { setBusy(""); }
  }

  async function resolve(event: FormEvent<HTMLFormElement>, dispute: Dispute) {
    event.preventDefault(); setBusy(dispute.id); setMessage("");
    const form = new FormData(event.currentTarget);
    try { const response = await fetch(`/api/admin/disputes/${dispute.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision: form.get("decision"), response: responses[dispute.id] }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setMessage(result.message); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Dispute update failed."); }
    finally { setBusy(""); }
  }

  async function markPayout(orderId: string) {
    setBusy(orderId); setMessage("");
    try { const response = await fetch("/api/admin/payouts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId, transferReference: references[orderId] }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setMessage(result.message); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not record payout."); }
    finally { setBusy(""); }
  }

  return <PageShell><PageHead eyebrow="RESTRICTED STAFF AREA" title="Admin dashboard." description="Review FUTA student sellers, respond to disputes, and record seller payouts after the one-business-day hold." />{message && <div className={`status-note ${allowed ? "" : "error"}`} role="status">{message}</div>}{allowed && stats && <><div className="admin-grid">{[["Students", stats.students], ["Active listings", stats.activeListings], ["Verifications waiting", stats.pendingVerifications], ["Open disputes", stats.openDisputes], ["Payouts due", stats.payoutsDue], ["Paid orders", stats.paidOrders], ["Platform fees", formatNaira(stats.platformFeesNgn)]].map(([label, value]) => <div className="admin-stat" key={label}><span className="condition-note">{label}</span><strong>{value}</strong></div>)}</div><div className="content-card"><h2>Seller verification queue</h2>{verifications.length ? verifications.map((item) => <article className="offer-card" key={item.id}><h3>{item.displayName} · {item.email}</h3><p>Submitted {new Date(item.submittedAt).toLocaleString("en-NG")}</p><div className="admin-docs"><figure><img src={item.studentIdUrl} alt={`${item.displayName} student ID`} /><figcaption>Student ID (private preview)</figcaption></figure><figure><img src={item.selfieUrl} alt={`${item.displayName} selfie`} /><figcaption>Selfie (private preview)</figcaption></figure></div><div className="field"><label htmlFor={`reason-${item.id}`}>If rejecting, explain what they should correct</label><textarea id={`reason-${item.id}`} value={reasons[item.id] ?? ""} onChange={(event) => setReasons({ ...reasons, [item.id]: event.target.value })} maxLength={1000} placeholder="For example: The ID text is not legible; please upload a clearer image." /></div><div className="offer-actions"><button className="button button-dark" disabled={busy === item.id} onClick={() => review(item.id, "approve")}><BadgeCheck size={15} /> Approve</button><button className="outline-button" disabled={busy === item.id} onClick={() => review(item.id, "reject")}>Reject and send reason</button></div><p className="condition-note">Verify only the minimum needed. Do not download/share identity images. Delete documents under the published retention policy.</p></article>) : <p className="condition-note">No seller verifications waiting.</p>}</div><div className="content-card"><h2>Dispute resolution queue</h2>{disputes.length ? disputes.map((dispute) => <form className="offer-card" key={dispute.id} onSubmit={(event) => resolve(event, dispute)}><h3>{dispute.listingTitle} · {dispute.status.replaceAll("_", " ")}</h3><p>{dispute.reason}</p><div className="field"><label htmlFor={`decision-${dispute.id}`}>Resolution</label><select name="decision" id={`decision-${dispute.id}`} defaultValue="under_review"><option value="under_review">Keep under review</option><option value="resolved_buyer">Resolve for buyer (refund manually in Paystack)</option><option value="resolved_seller">Resolve for seller</option></select></div><div className="field"><label htmlFor={`response-${dispute.id}`}>Message to both students</label><textarea id={`response-${dispute.id}`} required minLength={10} maxLength={2000} value={responses[dispute.id] ?? ""} onChange={(event) => setResponses({ ...responses, [dispute.id]: event.target.value })} placeholder="Explain your decision and next steps…" /></div><button className="button button-dark" disabled={busy === dispute.id}>Save review and notify students</button></form>) : <p className="condition-note">No disputes waiting.</p>}</div><div className="content-card"><h2>Seller payouts due</h2><p className="condition-note">Transfers are manual: send money to the seller through your approved Paystack/bank workflow, then record the transfer reference here. Do not mark as paid before funds are sent.</p>{payouts.length ? payouts.map((payout) => <article className="offer-card" key={payout.id}><h3>Order {payout.id.slice(0, 8)} · {payout.sellerName} · {formatNaira(payout.seller_payout_ngn)}</h3><p>Item amount {formatNaira(payout.amount_ngn)} · Seller fee (5%) {formatNaira(payout.seller_fee_ngn)} · Due since {new Date(payout.payout_due_at).toLocaleString("en-NG")}</p><p><strong>Payout destination shown because payment is due</strong><br />{payout.payoutDetails ? `${payout.payoutDetails.bankName} · ${payout.payoutDetails.accountName} · ${payout.payoutDetails.accountNumber}` : "No payout account on file — contact seller securely before transferring."}</p><div className="field"><label htmlFor={`ref-${payout.id}`}>Transfer reference</label><input id={`ref-${payout.id}`} value={references[payout.id] ?? ""} onChange={(event) => setReferences({ ...references, [payout.id]: event.target.value })} required placeholder="Bank/Paystack transfer reference" /></div><button className="button button-dark" disabled={busy === payout.id || !references[payout.id]?.trim()} onClick={() => markPayout(payout.id)}>Record payout sent</button></article>) : <p className="condition-note">No payouts are due today.</p>}</div></>}</PageShell>;
}
