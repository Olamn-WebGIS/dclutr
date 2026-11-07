"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";

const categories = ["Campus essentials", "Furniture", "Home appliances"];

export default function EmailPreferencesPage() {
  const [subscribed, setSubscribed] = useState(false);
  const [savedCategories, setSavedCategories] = useState<string[]>([]);
  const [categoryAlerts, setCategoryAlerts] = useState(false);
  const [priceAlerts, setPriceAlerts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/marketing-preferences")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          if (active && response.status === 401) setNeedsLogin(true);
          throw new Error(result.error || "Could not load your email preferences.");
        }
        if (active) {
          setSubscribed(result.subscribed);
          setSavedCategories(result.categories ?? []);
          setCategoryAlerts(result.categoryAlerts ?? false);
          setPriceAlerts(result.priceAlerts ?? false);
        }
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Could not load your email preferences.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function savePreference(nextSubscribed = subscribed) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/marketing-preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscribed: nextSubscribed, categories: savedCategories, categoryAlerts, priceAlerts }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update your email preferences.");
      setSubscribed(result.subscribed);
      setCategoryAlerts(nextSubscribed && categoryAlerts);
      setPriceAlerts(nextSubscribed && priceAlerts);
      setMessage(result.subscribed ? "Your marketplace email preferences are saved." : "You’ve been unsubscribed from marketplace emails.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update your email preferences.");
    } finally { setBusy(false); }
  }

  function toggleCategory(category: string) {
    setSavedCategories((current) => {
      const next = current.includes(category) ? current.filter((item) => item !== category) : [...current, category];
      if (!next.length) setCategoryAlerts(false);
      return next;
    });
  }

  return (
    <PageShell>
      <div className="auth-wrap">
        <section className="auth-card email-preferences-card" aria-labelledby="email-preferences-title">
          <span className="eyebrow">YOUR INBOX, YOUR CHOICE</span>
          <h1 id="email-preferences-title">Email preferences.</h1>
          <p>Choose whether D_clutr can email marketplace reminders and new-item alerts for categories you care about.</p>
          {loading ? <p role="status">Loading your preferences…</p> : loadError ? <p role="alert">{loadError}{needsLogin && <> <Link href="/auth">Sign in</Link>.</>}</p> : (
            <>
              <label className="email-preference-toggle">
                <input type="checkbox" checked={subscribed} onChange={(event) => { setSubscribed(event.target.checked); if (!event.target.checked) { setCategoryAlerts(false); setPriceAlerts(false); } }} />
                <span>Send me optional D_clutr marketplace emails. I can unsubscribe at any time.</span>
              </label>
              <fieldset className="email-preferences-categories">
                <legend>Saved categories for new-item alerts</legend>
                <p className="condition-note">Get a daily digest when new items are posted in selected categories. These alerts require marketplace email consent.</p>
                {categories.map((category) => <label className="email-category-option" key={category}>
                  <input type="checkbox" checked={savedCategories.includes(category)} onChange={() => toggleCategory(category)} />
                  {category}
                </label>)}
              </fieldset>
              <label className="email-preference-toggle">
                <input type="checkbox" checked={categoryAlerts} onChange={(event) => setCategoryAlerts(event.target.checked)} disabled={savedCategories.length === 0} />
                <span>Send me new-item alerts for these categories.</span>
              </label>
              <label className="email-preference-toggle">
                <input type="checkbox" checked={priceAlerts} onChange={(event) => setPriceAlerts(event.target.checked)} disabled={!subscribed} />
                <span>Send me a daily digest when a new similar item is listed for less than an item I searched for or viewed. Searches and views are used for matching; saved interests expire after 30 days.</span>
              </label>
              <button className="button button-dark" type="button" disabled={busy} onClick={() => savePreference()}>
                {busy ? "Saving…" : "Save email preferences"}
              </button>
              {message && <p role="status">{message}</p>}
            </>
          )}
          <p className="form-note">Account, security, and order emails are separate from marketing reminders. You can change this choice at any time.</p>
        </section>
      </div>
    </PageShell>
  );
}
