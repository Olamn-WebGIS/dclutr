"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";

type Analytics = {
  totals: { visits: number; listingViews: number; listings: number; firstConversations: number; completedOrders: number; emailClicks: number };
  days: Array<{ day: string; visits: number; listing_views: number; listings: number; first_conversations: number; completed_orders: number; email_clicks: number }>;
};

const cells: Array<{ key: keyof Analytics["days"][number]; totalKey: keyof Analytics["totals"]; label: string }> = [
  { key: "visits", totalKey: "visits", label: "Visits" },
  { key: "listing_views", totalKey: "listingViews", label: "Listing views" },
  { key: "listings", totalKey: "listings", label: "Listings" },
  { key: "first_conversations", totalKey: "firstConversations", label: "First chats" },
  { key: "completed_orders", totalKey: "completedOrders", label: "Completed orders" },
  { key: "email_clicks", totalKey: "emailClicks", label: "Email clicks" },
];

export function AdminAnalyticsPanel() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Analytics are unavailable.");
        setAnalytics(data);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Analytics are unavailable."));
  }, []);

  if (!analytics && !error) return <PageShell><section className="content-card" aria-live="polite">Loading marketplace engagement…</section></PageShell>;
  if (!analytics) return <PageShell><section className="content-card" role="alert">{error}</section></PageShell>;

  return (
    <PageShell>
      <section className="content-card">
        <h2>Marketplace engagement · last 30 days</h2>
        <p className="condition-note">Visits and listing views are deduplicated per signed-in student per day. Email clicks are measured; email opens are not tracked.</p>
        <div className="admin-grid">
          {cells.map(({ key, totalKey, label }) => <div className="admin-stat" key={key}><span className="condition-note">{label}</span><strong>{analytics.totals[totalKey]}</strong></div>)}
        </div>
        <div style={{ overflowX: "auto", marginTop: 20 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead><tr>{["Date (UTC)", ...cells.map(({ label }) => label)].map((label) => <th key={label} style={{ padding: 8, borderBottom: "1px solid #e6e7dc" }}>{label}</th>)}</tr></thead>
            <tbody>{analytics.days.map((day) => <tr key={day.day}>
              <td style={{ padding: 8, borderBottom: "1px solid #e6e7dc" }}>{day.day}</td>
              {cells.map(({ key }) => <td key={key} style={{ padding: 8, borderBottom: "1px solid #e6e7dc" }}>{day[key]}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}
