"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { PageHead, PageShell } from "@/components/page-shell";
import { ProductGrid } from "@/components/product-grid";
import { categories, type Product } from "@/data/products";
import { showToast } from "@/lib/notifications";

const PAGE_SIZE = 12;

export default function MarketPage() {
  const [category, setCategory] = useState("Everything");
  const [query, setQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState("featured");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [retryToken, setRetryToken] = useState(0);
  const [categoryReady, setCategoryReady] = useState(false);
  useEffect(() => {
    const requestedCategory = new URLSearchParams(window.location.search).get("category");
    if (requestedCategory && categories.includes(requestedCategory)) setCategory(requestedCategory);
    setCategoryReady(true);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchTerm(query.trim());
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (!categoryReady) return;
    const controller = new AbortController();
    const firstPage = page === 0;
    if (firstPage) {
      setLoading(true);
      setProducts([]);
      setHasMore(false);
    } else {
      setLoadingMore(true);
    }
    setLoadFailed(false);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
      category,
      sort,
    });
    if (searchTerm) params.set("q", searchTerm);
    fetch(`/api/listings?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error("We can’t load D_clutr items right now. Please try again in a bit.");
        return result as { listings: Product[]; hasMore: boolean };
      })
      .then((result) => {
        setProducts((current) => firstPage ? result.listings : [...current, ...result.listings]);
        setHasMore(result.hasMore);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadFailed(true);
        showToast("We can’t load D_clutr items right now. Please try again in a bit.", "error");
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setLoading(false);
        setLoadingMore(false);
      });
    return () => controller.abort();
  }, [category, categoryReady, page, retryToken, searchTerm, sort]);
  const visibleCategories = categories.filter((item) => item !== "Everything");
  useEffect(() => {
    if (searchTerm.length < 2 || !products.length) return;
    const timer = window.setTimeout(() => {
      fetch("/api/price-alert-interests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: searchTerm, listingIds: products.slice(0, 100).map((product) => product.id) }),
      }).then(async (response) => {
        if (!response.ok && response.status !== 401) {
          const error = await response.json();
          console.error("Could not save this search as a lower-price alert interest:", error.error);
        }
      }).catch((error: unknown) => console.error("Could not save this search as a lower-price alert interest:", error));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [products, searchTerm]);
  return <PageShell>
    <PageHead eyebrow="ITEMS FROM FUTA STUDENTS" title="D_clutr items for campus life." description="Browse room essentials, study materials, and everyday items posted by students in Akure." />
    <div className="market-tools"><div className="search-wrap"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search for a mattress, fan, or book" aria-label="Search D_clutr items" /></div><select className="select-control" value={sort} onChange={(event) => { setSort(event.target.value); setPage(0); }} aria-label="Sort items"><option value="featured">Sort: Recommended</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></div>
    <div className="category-row" aria-label="Categories">{visibleCategories.map((item) => <button key={item} className={`category-pill ${category === item ? "active" : ""}`} onClick={() => { setCategory(item); setPage(0); }}>{item}</button>)}</div>
    <p className="market-count" aria-live="polite">{products.length} {products.length === 1 ? "item" : "items"} loaded</p>
    {loading && page === 0 ? <div className="status-note">Loading D_clutr items…</div> : products.length ? <>
      <ProductGrid items={products} />
      {loadFailed && <p className="status-note error" role="status">We couldn’t load more items. Check your connection and try again.</p>}
      {hasMore && <div className="market-pagination"><button className="button button-dark" type="button" disabled={loadingMore} onClick={() => loadFailed ? setRetryToken((token) => token + 1) : setPage((current) => current + 1)}>{loadingMore ? "Loading items…" : loadFailed ? "Try again" : "Load more items"}</button></div>}
    </> : loadFailed ? <div className="status-note error" role="status">We can’t load D_clutr items right now. Please try again in a bit. <button className="text-link" type="button" onClick={() => setRetryToken((token) => token + 1)}>Try again</button></div> : !loading && <div className="empty-state"><h2>No items here yet</h2><p>Try another search or category, or check back later.</p></div>}
    <div style={{ height: 75 }} />
  </PageShell>;
}
