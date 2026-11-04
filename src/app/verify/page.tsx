"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { PageHead, PageShell } from "@/components/page-shell";

type Submission = { id: string; status: string; rejection_reason: string | null; submitted_at: string } | null;

export default function VerifyPage() {
  const [submission, setSubmission] = useState<Submission>(null);
  const [verificationStatus, setVerificationStatus] = useState("not_submitted");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    const response = await fetch("/api/verification", { cache: "no-store" }); const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Log in to verify your profile.");
    setSubmission(data.submission); setVerificationStatus(data.verificationStatus);
  }
  useEffect(() => {
    const updateStatus = () => refresh().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "We couldn’t load your verification status. Please try again."));
    updateStatus();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") updateStatus();
    }, 15000);
    window.addEventListener("focus", updateStatus);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", updateStatus); };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/verification", { method: "POST", body: new FormData(event.currentTarget) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "We couldn’t send your documents. Please try again.");
      setMessage(data.message); setVerificationStatus("pending"); setSubmission({ id: "pending", status: "pending", rejection_reason: null, submitted_at: new Date().toISOString() });
    } catch (error) { setMessage(error instanceof Error ? error.message : "We couldn’t send your documents. Please try again."); }
    finally { setBusy(false); }
  }
  const locked = verificationStatus === "approved" || verificationStatus === "pending";
  return (
    <PageShell>
      <PageHead eyebrow="FUTA SELLER CHECK" title="Verify your student profile." description="Verification is optional. Upload your FUTA student ID and a selfie if you’d like a badge showing buyers you’re a FUTA student." />
      <section className="verify-card">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ShieldCheck size={25} color="#567452" />
          <div><strong style={{ fontSize: 13 }}>Your documents stay private</strong><p style={{ color: "#7b857a", fontSize: 11 }}>Only you and authorized D_clutr team members can view your student ID and selfie.</p></div>
        </div>
        {verificationStatus === "approved" && <div className="notice"><BadgeCheck size={16} style={{ verticalAlign: "middle", marginRight: 7 }} />Your profile is verified. Your posts can now show the verified student badge.</div>}
        {verificationStatus === "pending" && <div className="notice" role="status">Our team is checking your documents. We’ll let you know when there’s an update.</div>}
        {verificationStatus === "rejected" && <div className="notice" role="status"><strong>One more try needed.</strong><p style={{ margin: "7px 0 0" }}>{submission?.rejection_reason || "We need clearer documents. Please upload both images again."}</p></div>}
        {message && <div className="status-note" role="status">{message}</div>}
        {!locked && <form className="live-form" onSubmit={submit}>
          <div className="field"><label htmlFor="studentId">Your FUTA student ID (JPG, PNG, or WebP; up to 5 MB)</label><input id="studentId" name="studentId" type="file" accept="image/jpeg,image/png,image/webp" required /></div>
          <div className="field"><label htmlFor="selfie">A clear selfie (JPG, PNG, or WebP; up to 5 MB)</label><input id="selfie" name="selfie" type="file" accept="image/jpeg,image/png,image/webp" required /></div>
          <p className="condition-note">Upload your own documents only. Never include bank or payment details. Need help? Email our support team.</p>
          <button className="button button-dark" disabled={busy}>{busy ? "Sending for review…" : verificationStatus === "rejected" ? "Send new photos" : "Send for review"}</button>
        </form>}
        <Link className="text-link" href="/profile">Back to your profile</Link>
      </section>
    </PageShell>
  );
}
