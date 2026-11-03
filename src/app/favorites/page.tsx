"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { PageHead, PageShell } from "@/components/page-shell";
import { ProductGrid } from "@/components/product-grid";
import type { Product } from "@/data/products";

export default function FavoritesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState("Loading your saved items…");
  useEffect(() => {
    fetch("/api/favorites").then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Log in to see your saved items."); return data.listings as Product[]; })
      .then((items) => { setProducts(items); setMessage(items.length ? "" : "Log in and tap the heart on anything you like to save it here."); })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "We couldn’t load your saved items. Please try again."));
  }, []);
  return <PageShell><PageHead eyebrow="YOUR FAVOURITES" title="Saved for later." description="Keep the D_clutr items you like in one place, so they’re easy to find again." />{products.length ? <><div style={{ marginBottom: 15, display: "flex", gap: 7, alignItems: "center", color: "#7a8579", fontSize: 11 }}><Heart size={15} /> Your saved items</div><ProductGrid items={products} /></> : <div className="empty-state"><p>{message}</p><Link className="button button-dark" href="/market">Browse D_clutr items</Link></div>}<div style={{ height: 75 }} /></PageShell>;
}
