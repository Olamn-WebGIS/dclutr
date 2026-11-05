"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { showToast } from "@/lib/notifications";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const resetToken = new URLSearchParams(window.location.search).get("token") || "";
    setToken(resetToken);
    if (!resetToken) showToast("This reset link isn’t valid. Request a new one from the sign-in page.", "error");
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password: form.get("password") }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "We couldn’t update your password. Please try again.");
      showToast(result.message, "success"); window.dispatchEvent(new Event("dclutr:auth-change")); router.push("/profile");
    } catch (error) { showToast(error instanceof Error ? error.message : "We couldn’t update your password. Please try again.", "error"); }
    finally { setBusy(false); }
  }
  return <PageShell><div className="auth-wrap"><form className="auth-card" onSubmit={submit}><span className="eyebrow">ACCOUNT SECURITY</span><h1>Choose a new password.</h1><p>Your reset link works once and expires after 30 minutes.</p><div className="field"><label htmlFor="password">New password</label><input id="password" name="password" type="password" minLength={12} maxLength={128} required disabled={!token} autoComplete="new-password" placeholder="At least 12 characters" /></div><button className="button button-dark" disabled={busy || !token}>{busy ? "Updating…" : "Save new password"}</button><p className="form-toggle"><Link href="/auth">Back to sign in</Link></p></form></div></PageShell>;
}
