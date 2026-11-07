"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { showToast } from "@/lib/notifications";

export default function AuthPage() {
  const [signup, setSignup] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const endpoint = forgot ? "/api/auth/forgot-password" : signup ? "/api/auth/signup" : "/api/auth/login";
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: form.get("name"), email: form.get("email"), password: form.get("password"), marketingConsent: form.get("marketingConsent") === "on" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Please try again.");
      if (result.signedIn || (!signup && !forgot)) { window.dispatchEvent(new Event("dclutr:auth-change")); router.push("/market"); }
      else showToast(result.message, "success");
    } catch (error) { showToast(error instanceof Error ? error.message : "We couldn’t sign you in. Please try again.", "error"); }
    finally { setBusy(false); }
  }
  return <PageShell><div className="auth-wrap"><form className="auth-card" onSubmit={submit}><span className="eyebrow">FUTA STUDENT MARKETPLACE</span><h1>{forgot ? "Reset your password." : signup ? "Join D_clutr." : "Hello again."}</h1><p>{forgot ? "If an account uses that email, we’ll send you a one-use reset link. We can’t see or send your current password." : signup ? "Create an account to find campus essentials and connect with other FUTA students." : "Log in to pick up where you left off."}</p>{signup && <div className="field"><label htmlFor="name">Your name</label><input id="name" name="name" required placeholder="Your name" /></div>}<div className="field"><label htmlFor="email">Your email</label><input id="email" name="email" type="email" required placeholder="you@example.com" /></div>{!forgot && <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" required minLength={12} placeholder="At least 12 characters" /></div>}{signup && <div className="field"><label><input name="marketingConsent" type="checkbox" /> Email me one useful D_clutr marketplace reminder every seven days, with tips to buy, sell, and refer other FUTA students. I can unsubscribe at any time. This is optional.</label></div>}{!forgot && !signup && <button type="button" className="text-link" onClick={() => setForgot(true)}>Forgot password?</button>}<button className="button button-dark" type="submit" disabled={busy}>{busy ? "Please wait…" : forgot ? "Email me a reset link" : signup ? "Create my account" : "Log in"}</button>{!forgot && <div className="form-note">By continuing, you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</div>}<div className="form-toggle">{forgot ? "Remember your password? " : signup ? "Already on D_clutr? " : "New to D_clutr? "}<button type="button" className="text-link" onClick={() => { if (forgot) setForgot(false); else setSignup(!signup); }}>{forgot ? "Log in" : signup ? "Log in" : "Create an account"}</button></div></form></div></PageShell>;
}
