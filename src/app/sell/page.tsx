"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHead, PageShell } from "@/components/page-shell";
import { showToast } from "@/lib/notifications";
import { isPhoneOrLaptopListing, prohibitedListingMessage } from "@/lib/listing-restrictions";

type RelistDraft = { id: string; title: string; description: string; category: string; condition: string; price_ngn: number; negotiable: boolean; meetup_area: string };

const meetupLocations = ["Main Campus", "North Gate", "South Gate", "West Gate"];
const supportedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxPhotoSize = 5 * 1024 * 1024;

function getPhotoError(files: File[]) {
  if (!files.length) return "Please choose 1 to 5 JPG, PNG, or WebP photos to continue.";
  if (files.length > 5) return "Please choose no more than 5 photos.";
  if (files.some((file) => !supportedPhotoTypes.has(file.type))) {
    return "This photo format isn’t supported. Please choose a still JPG, PNG, or WebP image. Live Photos and HEIC/HEIF files aren’t supported yet.";
  }
  if (files.some((file) => file.size > maxPhotoSize)) return "This photo is a bit too large. Please choose an image that’s 5 MB or smaller.";
  return "";
}

export default function SellPage() {
  const [hasPayoutProfile, setHasPayoutProfile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [relistDraft, setRelistDraft] = useState<RelistDraft | null>(null);
  const [relistLoading, setRelistLoading] = useState(false);
  const router = useRouter();
  const relistMeetupLocation = relistDraft?.meetup_area.split(" • ").slice(1).join(" • ") ?? "";

  useEffect(() => {
    fetch("/api/payout-profile")
      .then(async (response) => {
        if (!response.ok) return;
        const payout = await response.json();
        setHasPayoutProfile(Boolean(payout.hasPayoutProfile));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const listingId = new URLSearchParams(window.location.search).get("relist");
    if (!listingId) return;
    setRelistLoading(true);
    fetch(`/api/me/listings?relist=${encodeURIComponent(listingId)}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "This item is no longer available to relist.");
        setRelistDraft(result.listing);
      })
      .catch((error: unknown) => showToast(error instanceof Error ? error.message : "Could not load this listing.", "error"))
      .finally(() => setRelistLoading(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (isPhoneOrLaptopListing(String(formData.get("title") ?? ""), String(formData.get("description") ?? ""))) {
      showToast(prohibitedListingMessage, "error");
      return;
    }
    const photoFiles = formData.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0);
    const photoError = getPhotoError(photoFiles);
    if (photoError) {
      showToast(photoError, "error");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/listings", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "We couldn’t post your item. Please check the details and try again.");
      showToast(data.message, "success");
      router.push(`/product/${data.listing.id}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "We couldn’t post your item. Please check the details and try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <PageHead
        eyebrow="PASS A GOOD THING ON"
        title={relistDraft ? "Relist your item." : "Post something for sale."}
        description="Any signed-in FUTA student can post. Verify your profile if you’d like the verified student badge on your item."
      />

      {relistLoading ? <div className="status-note">Loading your listing details…</div> : <form key={relistDraft?.id ?? "new-listing"} className="content-card live-form" onSubmit={submit}>
          <h2>Tell buyers about your item</h2>
        <p className="condition-note" style={{ marginTop: 0 }}>
          {relistDraft ? "We filled in the details from your active listing. Confirm they’re still accurate and add fresh photos before posting." : "Add your hostel and pickup point so buyers know where to meet. Once payment is confirmed, you can share more details in chat."}
        </p>

        <div className="field">
          <label htmlFor="title">What are you selling?</label>
          <input id="title" name="title" required minLength={3} maxLength={100} placeholder="e.g. Mattress or study lamp" defaultValue={relistDraft?.title} />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="category">Category</label>
            <select id="category" name="category" required defaultValue={relistDraft?.category ?? ""}>
              <option value="" disabled>Choose one</option>
              <option>Campus essentials</option>
              <option>Home appliances</option>
              <option>Furniture</option>
              <option>Others</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="condition">Condition</label>
            <select id="condition" name="condition" required defaultValue={relistDraft?.condition ?? ""}>
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
            <label htmlFor="price">Your price (₦)</label>
            <input id="price" name="price" type="number" min="100" step="1" required placeholder="12500" defaultValue={relistDraft?.price_ngn} />
          </div>
          <div className="field">
            <label htmlFor="hostelName">Hostel name</label>
            <input id="hostelName" name="hostelName" required maxLength={80} placeholder="FUTA Hostel A or New Hostel" defaultValue={relistDraft?.meetup_area.split(" • ")[0]} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="itemAddress">Where should the buyer meet you?</label>
          <select id="itemAddress" name="itemAddress" required defaultValue={meetupLocations.includes(relistMeetupLocation) ? relistMeetupLocation : ""}>
            <option value="" disabled>Choose a pickup location</option>
            {meetupLocations.map((location) => <option key={location} value={location}>{location}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="description">Tell buyers a little more</label>
          <textarea id="description" name="description" required minLength={10} maxLength={3000} placeholder="Describe the item, its condition, and anything a buyer should know." defaultValue={relistDraft?.description} />
        </div>

        <div className="field">
          <label htmlFor="negotiable">Open to offers?</label>
          <select id="negotiable" name="negotiable" defaultValue={relistDraft?.negotiable ? "true" : "false"}>
            <option value="false">No</option>
            <option value="true">Yes, I&apos;m open to offers</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="photos">Add 1 to 5 photos</label>
          <input
            id="photos"
            name="photos"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            required
            onInvalid={(event) => {
              if (event.currentTarget.validity.valueMissing) {
                event.currentTarget.setCustomValidity("Please choose 1 to 5 JPG, JPEG, PNG, or WebP photos to continue.");
              }
            }}
            onChange={(event) => {
              const input = event.currentTarget;
              const error = getPhotoError(Array.from(input.files ?? []));
              input.setCustomValidity(error);
              if (error) input.reportValidity();
            }}
          />
          <p className="condition-note">Choose JPG, JPEG, PNG, or WebP photos (up to 5 MB each). Live Photos and HEIC/HEIF images aren’t supported.</p>
        </div>

        {!hasPayoutProfile && (
          <>
            <p className="condition-note">For your first post, add the bank details you want us to use for your seller payout. You can update them from your profile later.</p>
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
              <input
                id="accountNumber"
                name="accountNumber"
                required
                inputMode="numeric"
                pattern="[0-9]{10}"
                maxLength={10}
                placeholder="0123456789"
                onInvalid={(event) => event.currentTarget.setCustomValidity("Please enter your 10-digit Nigerian bank account number using numbers only.")}
                onInput={(event) => event.currentTarget.setCustomValidity("")}
              />
            </div>
          </>
        )}

        <button className="button button-dark" type="submit" disabled={busy}>
          {busy ? "Posting your item…" : "Post item"}
        </button>
      </form>}
    </PageShell>
  );
}
