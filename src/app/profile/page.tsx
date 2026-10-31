"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { BadgeCheck, MapPin } from "lucide-react";
import { PageHead, PageShell } from "@/components/page-shell";
import { formatNaira } from "@/lib/currency";

type Listing = { id: string; title: string; price_ngn: number; status: string; expires_at: string; negotiable: boolean };
type Profile = { display_name: string; email: string; role: string; verification_status: string };
type PayoutProfile = { hasPayoutProfile: boolean; bankName?: string; accountName?: string; accountNumber?: string };

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [payoutProfile, setPayoutProfile] = useState<PayoutProfile | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [savingPayout, setSavingPayout] = useState(false);
  async function load() {
    const [meResponse, listingResponse] = await Promise.all([fetch("/api/auth/me"), fetch("/api/me/listings")]);
    const me = await meResponse.json(); const listingData = await listingResponse.json();
    if (!meResponse.ok) throw new Error(me.error || "Please log in to view your account.");
    if (!listingResponse.ok) throw new Error(listingData.error || "Could not load your listings.");
    setProfile(me.user.profile); setListings(listingData.listings);
    if (listingData.listings.length) {
      const payoutResponse = await fetch("/api/payout-profile");
      if (payoutResponse.ok) setPayoutProfile(await payoutResponse.json());
    } else setPayoutProfile(null);
  }
  useEffect(() => { load().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Unable to load your profile.")); }, []);
  async function removeListing(id: string) {
    if (!window.confirm("Remove this item and its photos from D_clutr? This cannot be undone.")) return;
    setBusy(id); setMessage("");
    try { const response = await fetch(`/api/listings/${id}`, { method: "DELETE" }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not remove listing."); setMessage(result.message); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not remove listing."); }
    finally { setBusy(""); }
  }
  async function savePayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSavingPayout(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/payout-profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ bankName: form.get("bankName"), accountName: form.get("accountName"), accountNumber: form.get("accountNumber") }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not save payout details.");
      setMessage(result.message); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save payout details."); }
    finally { setSavingPayout(false); }
  }
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); window.dispatchEvent(new Event("dclutr:auth-change")); window.location.href = "/"; }
  return <PageShell><PageHead eyebrow="YOUR D_CLUTR CORNER" title="Your profile." description="Manage your student seller profile, listings, and exchanges." />{message && <div className="status-note" role="status">{message}</div>}{profile && <section className="content-card"><div className="profile-head"><div className="profile-big">{profile.display_name.slice(0, 1).toUpperCase()}</div><div><h2 style={{ margin: "0 0 5px" }}>{profile.display_name}</h2><span style={{ color: "#758075", fontSize: 11 }}><MapPin size={12} style={{ verticalAlign: "middle" }} /> FUTA, Akure · {profile.email}</span><p style={{ color: "#778176", fontSize: 11 }}>{profile.verification_status === "approved" ? <span className="verified-inline"><BadgeCheck size={14} /> Verified FUTA seller</span> : `Seller verification: ${profile.verification_status.replaceAll("_", " ")}`}</p></div></div>{profile.verification_status !== "approved" && <div className="notice">Verify your student profile to publish listings and display the verified seller badge. <Link href="/verify" style={{ fontWeight: 700 }}>Verification →</Link></div>}<div className="order-toolbar"><Link className="outline-button" href="/offers">Offers</Link><Link className="outline-button" href="/chat">Messages</Link><Link className="outline-button" href="/verify">Seller verification</Link><Link className="outline-button" href="/disputes">Disputes</Link>{profile.role === "admin" && <Link className="button button-dark" href="/admin">Admin dashboard</Link>}<button className="outline-button" onClick={logout}>Sign out</button></div><div className="section-heading" style={{ marginTop: 32 }}><div><span className="eyebrow">YOUR ITEMS</span><h2 style={{ fontSize: 30 }}>My listings</h2></div><Link className="button button-dark" href="/sell">Create listing</Link></div>{listings.length ? listings.map((listing) => <article className="offer-card" key={listing.id}><h3><Link href={`/product/${listing.id}`}>{listing.title}</Link></h3><p>{formatNaira(listing.price_ngn)}{listing.negotiable ? " · Negotiable" : ""} · {listing.status.replaceAll("_", " ")}</p>{listing.status === "active" && <p className="condition-note">Expires {new Date(listing.expires_at).toLocaleString("en-NG")}</p>}{listing.status === "active" && <button className="outline-button" disabled={busy === listing.id} onClick={() => removeListing(listing.id)}>{busy === listing.id ? "Removing…" : "Remove listing and photos"}</button>}</article>) : <p className="condition-note">No listings yet. Once your seller verification is approved, you can publish an item here.</p>}{listings.length > 0 && <section className="offer-card"><h2>Seller payout account</h2><p className="condition-note">These details were collected for your first listing. They are encrypted and visible only to you and authorized payout admins when a payout is due. Only edit them if you own the account.</p><form key={`${payoutProfile?.bankName ?? ""}:${payoutProfile?.accountNumber ?? ""}`} onSubmit={savePayout} className="live-form"><div className="field"><label htmlFor="bankName">Bank name</label><input id="bankName" name="bankName" required maxLength={100} defaultValue={payoutProfile?.bankName ?? ""} /></div><div className="field"><label htmlFor="accountName">Account name</label><input id="accountName" name="accountName" required maxLength={120} defaultValue={payoutProfile?.accountName ?? ""} /></div><div className="field"><label htmlFor="accountNumber">10-digit account number</label><input id="accountNumber" name="accountNumber" required inputMode="numeric" pattern="[0-9]{10}" maxLength={10} defaultValue={payoutProfile?.accountNumber ?? ""} /></div><button className="outline-button" disabled={savingPayout}>{savingPayout ? "Saving securely…" : "Update payout account"}</button></form></section>}</section>}</PageShell>;
}
