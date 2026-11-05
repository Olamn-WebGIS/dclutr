"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { PageHead, PageShell } from "@/components/page-shell";
import { ProductGrid } from "@/components/product-grid";
import type { Product } from "@/data/products";
import { showToast } from "@/lib/notifications";

export default function FavoritesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => {
    fetch("/api/favorites").then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Log in to see your saved items."); return data.listings as Product[]; })
      .then(setProducts)
      .catch((error: unknown) => { setLoadFailed(true); showToast(error instanceof Error ? error.message : "We couldn’t load your saved items. Please try again.", "error"); })
      .finally(() => setLoading(false));
  }, []);
  return <PageShell><PageHead eyebrow="YOUR FAVOURITES" title="Saved for later." description="Keep the D_clutr items you like in one place, so they’re easy to find again." />{products.length ? <><div style={{ marginBottom: 15, display: "flex", gap: 7, alignItems: "center", color: "#7a8579", fontSize: 11 }}><Heart size={15} /> Your saved items</div><ProductGrid items={products} /></> : loading ? <div className="status-note">Loading your saved items…</div> : !loadFailed && <div className="empty-state"><p>Tap the heart on anything you like to save it here.</p><Link className="button button-dark" href="/market">Browse D_clutr items</Link></div>}<div style={{ height: 75 }} /></PageShell>;
}
