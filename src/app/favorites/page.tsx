"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { PageHead, PageShell } from "@/components/page-shell";
import { ProductGrid } from "@/components/product-grid";
import type { Product } from "@/data/products";

export default function FavoritesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState("Loading your saved listings…");
  useEffect(() => {
    fetch("/api/favorites").then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Sign in to see saved listings."); return data.listings as Product[]; })
      .then((items) => { setProducts(items); setMessage(items.length ? "" : "Sign in and save listings with the heart button to keep them here."); })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Unable to load saved listings."));
  }, []);
  return <PageShell><PageHead eyebrow="YOUR SAVED CAMPUS FINDS" title="Saved for later." description="Keep track of active FUTA student listings you might want to come back to." />{products.length ? <><div style={{ marginBottom: 15, display: "flex", gap: 7, alignItems: "center", color: "#7a8579", fontSize: 11 }}><Heart size={15} /> Your saved items</div><ProductGrid items={products} /></> : <div className="empty-state"><p>{message}</p><Link className="button button-dark" href="/market">Browse campus listings</Link></div>}<div style={{ height: 75 }} /></PageShell>;
}
