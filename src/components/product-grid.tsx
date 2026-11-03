"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import type { Product } from "@/data/products";
import { formatNaira } from "@/lib/currency";

export function ProductGrid({ items }: { items: Product[] }) {
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/favorites").then(async (response) => response.ok ? response.json() : null).then((data) => { if (data?.listingIds) setSaved(data.listingIds); }).catch(() => undefined);
  }, []);
  async function toggleSaved(id: string) {
    const shouldSave = !saved.includes(id);
    try {
      const response = await fetch("/api/favorites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listingId: id, saved: shouldSave }) });
      const result = await response.json();
      if (!response.ok) { window.alert(result.error || "Log in to save this item."); return; }
      setSaved((current) => shouldSave ? [...current, id] : current.filter((item) => item !== id));
    } catch { window.alert("We couldn’t update your saved items. Check your connection and try again."); }
  }
  return <div className="product-grid">
    {items.map((product) => <article className="product-card" key={product.id} style={{ position: "relative" }}>
      <Link href={`/product/${product.id}`} className={`product-art tone-${product.color}`} aria-label={`View ${product.name}`}>
        {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="product-photo" /> : <span className="product-glyph" aria-hidden="true">{product.icon}</span>}
        {product.featured && <span className="product-tag">A lovely find</span>}
        {product.sellerVerified && <span className="verified-tag">Verified FUTA seller</span>}
      </Link>
      <button className="save-button" aria-label={saved.includes(product.id) ? "Remove from saved items" : "Save this item"} aria-pressed={saved.includes(product.id)} onClick={() => void toggleSaved(product.id)}><Heart size={16} fill={saved.includes(product.id) ? "#486849" : "none"} /></button>
      <div className="product-meta"><div className="product-meta-top"><h3><Link href={`/product/${product.id}`}>{product.name}</Link></h3><span className="price">{formatNaira(product.price)}{product.originalPrice > product.price && <span className="price-old">{formatNaira(product.originalPrice)}</span>}</span></div><div className="product-sub"><span>{product.condition}{product.negotiable ? " · Negotiable" : ""}</span><span>{product.location}</span></div></div>
    </article>)}
  </div>;
}
