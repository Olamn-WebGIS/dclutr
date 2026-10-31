"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageHead, PageShell } from "@/components/page-shell";
import { ProductGrid } from "@/components/product-grid";
import { categories, type Product } from "@/data/products";

export default function MarketPage() {
  const [category, setCategory] = useState("Everything");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("featured");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const requestedCategory = new URLSearchParams(window.location.search).get("category");
    if (requestedCategory && categories.includes(requestedCategory)) setCategory(requestedCategory);
  }, []);
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
  const visibleCategories = categories.filter((item) => item !== "Everything");
  const filtered = useMemo(() => {
    let result = products.filter((item) => (category === "Everything" || item.category === category) && `${item.name} ${item.category} ${item.location}`.toLowerCase().includes(query.toLowerCase()));
    if (sort === "low") result = [...result].sort((a, b) => a.price - b.price);
    if (sort === "high") result = [...result].sort((a, b) => b.price - a.price);
    return result;
  }, [category, products, query, sort]);
  return <PageShell>
    <PageHead eyebrow="FUTA STUDENTS, BUYING AND SELLING NEARBY" title="The campus market." description="Find room essentials, study materials, and everyday pre-loved items from students around FUTA and Akure." />
    <div className="market-tools"><div className="search-wrap"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try ‘mattress’ or ‘fan’" aria-label="Search market" /></div><select className="select-control" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort items"><option value="featured">Sort: Recommended</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></div>
    <div className="category-row" aria-label="Categories">{visibleCategories.map((item) => <button key={item} className={`category-pill ${category === item ? "active" : ""}`} onClick={() => setCategory(item)}>{item}</button>)}</div>
    <p className="market-count">{filtered.length} lovely {filtered.length === 1 ? "find" : "finds"} to browse</p>
    {loading ? <div className="status-note">Loading live student listings…</div> : error ? <div className="status-note error">{error}</div> : filtered.length ? <ProductGrid items={filtered} /> : <div className="empty-state"><h2>No listings found</h2><p>Try a different search or category.</p></div>}
    <div style={{ height: 75 }} />
  </PageShell>;
}
