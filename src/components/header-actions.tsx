"use client";

import Link from "next/link";
import { Heart, MessageCircle, Plus, ShoppingBag, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { AccountNavigation } from "@/components/account-navigation";

type HeaderCounts = { unread_messages: number; pending_offers: number; checkout_orders: number };

const emptyCounts: HeaderCounts = { unread_messages: 0, pending_offers: 0, checkout_orders: 0 };

function CountLink({ href, label, count, children }: { href: string; label: string; count: number; children: React.ReactNode }) {
  return (
    <Link className="icon-link" href={href} aria-label={count > 0 ? `${label}, ${count} pending` : label} title={label}>
      {children}
      {count > 0 && <span className="header-count-badge" aria-hidden="true">{count > 99 ? "99+" : count}</span>}
    </Link>
  );
}

export function HeaderActions() {
  const [counts, setCounts] = useState(emptyCounts);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/header-activity", { cache: "no-store" });
        if (!response.ok) {
          if (response.status === 401 && active) setCounts(emptyCounts);
          return;
        }
        const data = await response.json();
        if (active) setCounts(data.counts ?? emptyCounts);
      } catch {
        if (active) setCounts(emptyCounts);
      }
    };
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    void refresh();
    const interval = window.setInterval(onVisible, 30000);
    window.addEventListener("focus", onVisible);
    window.addEventListener("dclutr:auth-change", onVisible);
    window.addEventListener("dclutr:activity-change", onVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("dclutr:auth-change", onVisible);
      window.removeEventListener("dclutr:activity-change", onVisible);
    };
  }, []);

  return (
    <div className="nav-actions">
      <Link className="nav-sell" href="/sell">Post an item</Link>
      <CountLink href="/favorites" label="Saved items" count={0}><Heart size={18} strokeWidth={1.7} /></CountLink>
      <CountLink href="/chat" label="Messages" count={counts.unread_messages}><MessageCircle size={18} strokeWidth={1.7} /></CountLink>
      <CountLink href="/offers" label="Offers" count={counts.pending_offers}><Tag size={18} strokeWidth={1.7} /></CountLink>
      <CountLink href="/checkout" label="Checkout" count={counts.checkout_orders}><ShoppingBag size={18} strokeWidth={1.7} /></CountLink>
      <AccountNavigation />
      <Link className="mobile-post-item" href="/sell" aria-label="Post an item" title="Post an item"><Plus size={24} strokeWidth={2} /></Link>
    </div>
  );
}