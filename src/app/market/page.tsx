"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageHead, PageShell } from "@/components/page-shell";
import { ProductGrid } from "@/components/product-grid";
import { categories, type Product } from "@/data/products";
import { showToast } from "@/lib/notifications";

export default function MarketPage() {
  const [category, setCategory] = useState("Everything");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("featured");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => {
    const requestedCategory = new URLSearchParams(window.location.search).get("category");
    if (requestedCategory && categories.includes(requestedCategory)) setCategory(requestedCategory);
  }, []);
  useEffect(() => {
    fetch("/api/listings")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error("We can’t load D_clutr items right now. Please try again in a bit.");
        return result.listings as Product[];
      })
      .then(setProducts)
      .catch(() => { setLoadFailed(true); showToast("We can’t load D_clutr items right now. Please try again in a bit.", "error"); })
      .finally(() => setLoading(false));
  }, []);
  const visibleCategories = categories.filter((item) => item !== "Everything");
  const filtered = useMemo(() => {
    let result = products.filter((item) => (category === "Everything" || item.category === category) && `${item.name} ${item.category} ${item.location}`.toLowerCase().includes(query.toLowerCase()));
    if (sort === "low") result = [...result].sort((a, b) => a.price - b.price);
    if (sort === "high") result = [...result].sort((a, b) => b.price - a.price);
    return result;
  }, [category, products, query, sort]);
  useEffect(() => {
    const search = query.trim();
    if (search.length < 2 || !filtered.length) return;
    const timer = window.setTimeout(() => {
      fetch("/api/price-alert-interests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: search, listingIds: filtered.slice(0, 100).map((product) => product.id) }),
      }).then(async (response) => {
        if (!response.ok && response.status !== 401) {
          const error = await response.json();
          console.error("Could not save this search as a lower-price alert interest:", error.error);
        }
      }).catch((error: unknown) => console.error("Could not save this search as a lower-price alert interest:", error));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [filtered, query]);
  return <PageShell>
    <PageHead eyebrow="ITEMS FROM FUTA STUDENTS" title="D_clutr items for campus life." description="Browse room essentials, study materials, and everyday items posted by students in Akure." />
    <div className="market-tools"><div className="search-wrap"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search for a mattress, fan, or book" aria-label="Search D_clutr items" /></div><select className="select-control" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort items"><option value="featured">Sort: Recommended</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></div>
    <div className="category-row" aria-label="Categories">{visibleCategories.map((item) => <button key={item} className={`category-pill ${category === item ? "active" : ""}`} onClick={() => setCategory(item)}>{item}</button>)}</div>
    <p className="market-count">{filtered.length} {filtered.length === 1 ? "item" : "items"} to browse</p>
    {loading ? <div className="status-note">Loading D_clutr items…</div> : !loadFailed && filtered.length ? <ProductGrid items={filtered} /> : !loadFailed && <div className="empty-state"><h2>No items here yet</h2><p>Try another search or category, or check back later.</p></div>}
    <div style={{ height: 75 }} />
  </PageShell>;
}
