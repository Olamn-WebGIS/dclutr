"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHead, PageShell } from "@/components/page-shell";

export default function SellPage() {
  const [hasPayoutProfile, setHasPayoutProfile] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/payout-profile")
      .then(async (response) => {
        if (!response.ok) return;
        const payout = await response.json();
        setHasPayoutProfile(Boolean(payout.hasPayoutProfile));
      })
      .catch(() => undefined);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/listings", { method: "POST", body: new FormData(event.currentTarget) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Listing could not be published.");
      router.push(`/product/${data.listing.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Listing could not be published.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <PageHead
        eyebrow="PASS A GOOD THING ON"
        title="List a campus find."
        description="Posting is open to all students. Your verified badge is separate from posting access and appears only after approval."
      />

      <form className="content-card live-form" onSubmit={submit}>
        <h2>Tell us about it</h2>
        {message && <div className="notice" role="status">{message}</div>}

        <p className="condition-note" style={{ marginTop: 0 }}>
          Add your hostel name and the exact pickup address. After payment is confirmed, you can share pickup details and exchange info in chat.
        </p>

        <div className="field">
          <label htmlFor="title">Listing title</label>
          <input id="title" name="title" required minLength={4} maxLength={100} placeholder="e.g. Mattress or study lamp" />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="category">Category</label>
            <select id="category" name="category" required defaultValue="">
              <option value="" disabled>Choose one</option>
              <option>Campus essentials</option>
              <option>Home appliances</option>
              <option>Furniture</option>
              <option>Others</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="condition">Condition</label>
            <select id="condition" name="condition" required defaultValue="">
              <option value="" disabled>Choose one</option>
              <option>Like New</option>
              <option>Good Condition</option>
              <option>Fairly Used</option>
              <option>Used</option>
            </select>
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="price">Price (?)</label>
            <input id="price" name="price" type="number" min="100" step="1" required placeholder="12500" />
          </div>
          <div className="field">
            <label htmlFor="hostelName">Hostel name</label>
            <input id="hostelName" name="hostelName" required maxLength={80} placeholder="FUTA Hostel A or New Hostel" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="itemAddress">Item address / exact pickup point</label>
          <input id="itemAddress" name="itemAddress" required maxLength={180} placeholder="e.g. Room 2B, Hostel A, FUTA South Gate" />
        </div>

        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea id="description" name="description" required minLength={10} maxLength={3000} placeholder="Describe the item, what condition it is in, and any important notes for the buyer." />
        </div>

        <div className="field">
          <label htmlFor="negotiable">Allow offers?</label>
          <select id="negotiable" name="negotiable" defaultValue="false">
            <option value="false">No</option>
            <option value="true">Yes, I&apos;m open to offers</option>
          </select>
        </div>

        {!hasPayoutProfile && (
          <>
            <div className="field-row">
              <div className="field">
                <label htmlFor="bankName">Bank name</label>
                <input id="bankName" name="bankName" required maxLength={100} placeholder="First Bank" />
              </div>
              <div className="field">
                <label htmlFor="accountName">Account name</label>
                <input id="accountName" name="accountName" required maxLength={120} placeholder="Ada Johnson" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="accountNumber">Bank account number</label>
              <input id="accountNumber" name="accountNumber" required inputMode="numeric" pattern="[0-9]{10}" maxLength={10} placeholder="0123456789" />
            </div>
          </>
        )}

        <div className="field">
          <label htmlFor="photos">Photos (1 to 5)</label>
          <input id="photos" name="photos" type="file" accept="image/*" multiple required />
        </div>

        <button className="button button-dark" type="submit" disabled={busy}>
          {busy ? "Publishing" : "Publish listing"}
        </button>
      </form>
    </PageShell>
  );
}
