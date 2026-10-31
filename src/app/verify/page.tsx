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
    const response = await fetch("/api/verification"); const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Sign in to verify your seller profile.");
    setSubmission(data.submission); setVerificationStatus(data.verificationStatus);
  }
  useEffect(() => { refresh().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Unable to load status.")); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/verification", { method: "POST", body: new FormData(event.currentTarget) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Upload failed.");
      setMessage(data.message); setVerificationStatus("pending"); setSubmission({ id: "pending", status: "pending", rejection_reason: null, submitted_at: new Date().toISOString() });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed. Please try again."); }
    finally { setBusy(false); }
  }
  const locked = verificationStatus === "approved" || verificationStatus === "pending";
  return <PageShell><PageHead eyebrow="FUTA SELLER CHECK" title="Verify your student profile." description="Upload your FUTA student ID and a selfie for private admin review. Only verified sellers can publish listings." /><section className="verify-card"><div style={{ display: "flex", alignItems: "center", gap: 12 }}><ShieldCheck size={25} color="#567452" /><div><strong style={{ fontSize: 13 }}>Your documents stay private</strong><p style={{ color: "#7b857a", fontSize: 11 }}>Student ID and selfie are stored in a private bucket. Access is limited to you and authorized D_clutr admins.</p></div></div>{verificationStatus === "approved" && <div className="notice"><BadgeCheck size={16} style={{ verticalAlign: "middle", marginRight: 7 }} />Your seller profile is verified. You can now post listings and receive a verified badge.</div>}{verificationStatus === "pending" && <div className="notice" role="status">Your documents are waiting for admin review. You’ll see the decision here.</div>}{verificationStatus === "rejected" && <div className="notice" role="status"><strong>One more try needed.</strong><p style={{ margin: "7px 0 0" }}>{submission?.rejection_reason || "The admin requested clearer documents. Please resubmit both images."}</p></div>}{message && <div className="status-note" role="status">{message}</div>}{!locked && <form className="live-form" onSubmit={submit}><div className="field"><label htmlFor="studentId">FUTA student ID card (JPG, PNG, or WebP; up to 5 MB)</label><input id="studentId" name="studentId" type="file" accept="image/jpeg,image/png,image/webp" required /></div><div className="field"><label htmlFor="selfie">A clear selfie (JPG, PNG, or WebP; up to 5 MB)</label><input id="selfie" name="selfie" type="file" accept="image/jpeg,image/png,image/webp" required /></div><p className="condition-note">Only submit documents for your own verification. Do not upload payment details. Contact the administrator if you need help.</p><button className="button button-dark" disabled={busy}>{busy ? "Uploading securely…" : verificationStatus === "rejected" ? "Resubmit for review" : "Submit for verification"}</button></form>}<p style={{ color: "#939b91", fontSize: 10, marginTop: 16 }}>Before public launch, publish a retention/deletion policy for identity documents and restrict admin access with strong account security.</p><Link className="text-link" href="/profile">Back to profile</Link></section></PageShell>;
}
