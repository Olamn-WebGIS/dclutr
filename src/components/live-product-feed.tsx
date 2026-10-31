"use client";

import { useEffect, useState } from "react";
import { ProductGrid } from "@/components/product-grid";
import type { Product } from "@/data/products";

export function LiveProductFeed({ limit = 4 }: { limit?: number }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/listings")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Marketplace is unavailable.");
        return result.listings as Product[];
      })
      .then(setProducts)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load current listings."))
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <div className="status-note">Loading live student listings…</div>;
  if (error) return <div className="status-note error">{error}</div>;
  if (!products.length) return <div className="status-note">No active listings yet. Once sellers are verified, new listings will appear here.</div>;
  return <ProductGrid items={products.slice(0, limit)} />;
}
