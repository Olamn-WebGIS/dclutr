"use client";

import { useEffect, useState } from "react";
import { ProductGrid } from "@/components/product-grid";
import type { Product } from "@/data/products";

export function LiveProductFeed({ limit = 4 }: { limit?: number }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(`/api/listings?limit=${limit}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error("We can’t load items right now. Please try again in a bit.");
        return result.listings as Product[];
      })
      .then(setProducts)
      .catch(() => setError("We can’t load items right now. Please try again in a bit."))
      .finally(() => setLoading(false));
  }, [limit]);
  if (loading) return <div className="status-note">Loading D_clutr items…</div>;
  if (error) return <div className="status-note error">{error}</div>;
  if (!products.length) return <div className="status-note">No one has posted yet. Check back soon for new items from FUTA students.</div>;
  return <ProductGrid items={products.slice(0, limit)} />;
}
