"use client";

import { useState, useRef, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import BusinessCard from "@/components/BusinessCard";
import ReviewsTable from "@/components/ReviewsTable";
import ExportButtons from "@/components/ExportButtons";
import { useLocationData } from "@/hooks/useLocationData";
import { useReviewsPolling } from "@/hooks/useReviewsPolling";
import { useBusinessInfoPolling } from "@/hooks/useBusinessInfoPolling";

interface Business {
  id: string;
  cid: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  category?: string | null;
  rating?: number | null;
  totalReviews?: number | null;
}

interface Review {
  id: string;
  authorName: string;
  rating: number;
  text?: string | null;
  publishedAt?: string | null;
  ownerResponse?: string | null;
}

export default function Page() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto p-6 text-gray-400">Ładowanie...</div>}>
      <ReviewsPage />
    </Suspense>
  );
}

const LIMIT = 100;

function ReviewsPage() {
  const [url, setUrl] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("prefill") || "";
    }
    return "";
  });
  const [cid, setCid] = useState<string | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [offset, setOffset] = useState(0);
  const [fromCache, setFromCache] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCost, setTotalCost] = useState<number | null>(null);
  const [selectedDepth, setSelectedDepth] = useState(100);
  const [sortBy, setSortBy] = useState<"newest" | "highest_rating" | "lowest_rating" | "relevant">("newest");

  const searchParams = useSearchParams();
  const cidFromUrl = searchParams.get("cid");

  // Sync prefill from searchParams (works with client-side navigation)
  useEffect(() => {
    const prefill = searchParams.get("prefill");
    if (prefill) setUrl(prefill);
  }, [searchParams]);
  const cidFromUrlRef = useRef(cidFromUrl);

  const locationData = useLocationData({ prefix: "reviews" });

  // Autocomplete state for location/language dropdowns
  const [locationQuery, setLocationQuery] = useState("");
  const [langQuery, setLangQuery] = useState("");
  const [showLocationDrop, setShowLocationDrop] = useState(false);
  const [showLangDrop, setShowLangDrop] = useState(false);
  const [locationActive, setLocationActive] = useState(-1);
  const [langActive, setLangActive] = useState(-1);
  const locationDropRef = useRef<HTMLDivElement>(null);
  const langDropRef = useRef<HTMLDivElement>(null);

  // Sync external locationData changes to query strings
  useEffect(() => { setLocationQuery(locationData.selectedCountry); }, [locationData.selectedCountry]);
  useEffect(() => { setLangQuery(locationData.selectedLanguage); }, [locationData.selectedLanguage]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (locationDropRef.current && !locationDropRef.current.contains(e.target as Node)) setShowLocationDrop(false);
      if (langDropRef.current && !langDropRef.current.contains(e.target as Node)) setShowLangDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredLocations = useMemo(() => {
    const q = locationQuery.toLowerCase();
    return q ? locationData.countries.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 15) : locationData.countries.slice(0, 15);
  }, [locationData.countries, locationQuery]);

  const filteredLanguages = useMemo(() => {
    const q = langQuery.toLowerCase();
    return q ? locationData.languages.filter((l) => l.name.toLowerCase().includes(q)).slice(0, 15) : locationData.languages.slice(0, 15);
  }, [locationData.languages, langQuery]);

  const scrollDropIntoView = useCallback((ref: React.RefObject<HTMLDivElement | null>, index: number) => {
    const ul = ref.current?.querySelector("ul");
    const item = ul?.children[index] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, []);

  const handleLocationKeyDown = (e: React.KeyboardEvent) => {
    if (!showLocationDrop && e.key === "ArrowDown") { setShowLocationDrop(true); setLocationActive(0); return; }
    if (!showLocationDrop) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setLocationActive((i) => { const n = Math.min(i + 1, filteredLocations.length - 1); scrollDropIntoView(locationDropRef, n); return n; });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setLocationActive((i) => { const n = Math.max(i - 1, 0); scrollDropIntoView(locationDropRef, n); return n; });
    } else if (e.key === "Enter" && locationActive >= 0) {
      e.preventDefault();
      const c = filteredLocations[locationActive];
      if (c) { locationData.handleCountryChange(c.name); setLocationQuery(c.name); setShowLocationDrop(false); setLocationActive(-1); }
    } else if (e.key === "Escape") {
      setShowLocationDrop(false); setLocationActive(-1);
    }
  };

  const handleLangKeyDown = (e: React.KeyboardEvent) => {
    if (!showLangDrop && e.key === "ArrowDown") { setShowLangDrop(true); setLangActive(0); return; }
    if (!showLangDrop) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setLangActive((i) => { const n = Math.min(i + 1, filteredLanguages.length - 1); scrollDropIntoView(langDropRef, n); return n; });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setLangActive((i) => { const n = Math.max(i - 1, 0); scrollDropIntoView(langDropRef, n); return n; });
    } else if (e.key === "Enter" && langActive >= 0) {
      e.preventDefault();
      const lang = filteredLanguages[langActive];
      if (lang) { locationData.handleLanguageChange(lang.name); setLangQuery(lang.name); setShowLangDrop(false); setLangActive(-1); }
    } else if (e.key === "Escape") {
      setShowLangDrop(false); setLangActive(-1);
    }
  };

  const fetchCosts = useCallback(() => {
    fetch("/api/costs").then((r) => r.json()).then((d) => setTotalCost(d.totalCost ?? 0)).catch(() => {});
  }, []);

  const handleReviewsCompleted = useCallback((newReviews: Review[], total: number) => {
    setReviews(newReviews);
    setTotalReviews(total);
    setOffset(0);
    setLoading(false);
    setRefreshing(false);
  }, []);

  const handleError = useCallback((err: string) => {
    setError(err);
    setLoading(false);
    setRefreshing(false);
  }, []);

  const reviewsPolling = useReviewsPolling({
    limit: LIMIT,
    onCompleted: handleReviewsCompleted,
    onError: handleError,
    onCostUpdate: fetchCosts,
  });

  const bizPolling = useBusinessInfoPolling({
    onBusinessUpdate: setBusiness,
    onCostUpdate: fetchCosts,
  });

  // Load costs on mount
  useEffect(() => { fetchCosts(); }, [fetchCosts]);

  // Recover pending tasks on mount
  useEffect(() => {
    if (!locationData.locationsLoaded) return;
    fetch("/api/reviews/pending")
      .then((r) => r.json())
      .then((data) => {
        const task = data.tasks?.[0];
        if (!task) return;
        if (task.business?.mapsUrl) setUrl(task.business.mapsUrl);
        setBusiness({ id: task.businessId, cid: task.business.cid, name: task.business.name });
        setCid(task.business.cid);
        reviewsPolling.setTaskDepth(task.depth);
        reviewsPolling.setTaskCreatedAt(task.createdAt);
        reviewsPolling.pollTaskStatus(task.id);
      })
      .catch(() => {});

    fetch("/api/business-info/pending")
      .then((r) => r.json())
      .then((data) => {
        const task = data.tasks?.[0];
        if (!task) return;
        if (!business) {
          setBusiness({ id: task.businessId, cid: task.business.cid, name: task.business.name } as Business);
          setCid(task.business.cid);
        }
        bizPolling.pollBusinessInfo(task.dfsTaskId, task.id);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationData.locationsLoaded]);

  // Load by CID from URL param
  useEffect(() => {
    if (!cidFromUrlRef.current) return;
    const targetCid = cidFromUrlRef.current;
    cidFromUrlRef.current = null;

    const loadByCid = async () => {
      setError(null);
      setLoading(true);
      reviewsPolling.setTaskStatus(null);

      try {
        const bizRes = await fetch("/api/business-info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cid: targetCid, cacheOnly: true }),
        });
        const bizData = await bizRes.json();
        if (bizRes.ok && bizData.business) {
          setBusiness(bizData.business);
          setCid(targetCid);
          setFromCache(true);
          if (bizData.asyncTaskId) {
            bizPolling.pollBusinessInfo(bizData.asyncTaskId, bizData.asyncDbTaskId);
          }
        }

        const revRes = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cid: targetCid, offset: 0, limit: LIMIT }),
        });
        const revData = await revRes.json();
        if (revRes.ok && revData.reviews) {
          setReviews(revData.reviews);
          setTotalReviews(revData.total);
          setOffset(0);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Błąd ładowania danych");
      } finally {
        setLoading(false);
      }
    };

    loadByCid();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async (mapsUrl: string, refresh = false) => {
    setError(null);
    setLoading(true);
    reviewsPolling.setTaskStatus(null);

    try {
      const cidRes = await fetch("/api/extract-cid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: mapsUrl }),
      });
      const cidData = await cidRes.json();
      if (!cidRes.ok) { setError(cidData.error); setLoading(false); return; }

      const extractedCid = cidData.cid;
      setCid(extractedCid);

      const bizRes = await fetch("/api/business-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cid: extractedCid, refresh, mapsUrl,
          locationName: locationData.selectedCountry, languageCode: locationData.selectedLanguageCode,
        }),
      });
      const bizData = await bizRes.json();
      if (!bizRes.ok) { setError(bizData.error); setLoading(false); return; }

      setBusiness(bizData.business);
      setFromCache(bizData.fromCache);
      if (bizData.asyncTaskId) bizPolling.pollBusinessInfo(bizData.asyncTaskId, bizData.asyncDbTaskId);

      const revRes = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cid: extractedCid, refresh, offset: 0, limit: LIMIT,
          languageName: locationData.selectedLanguage, locationName: locationData.selectedCountry, depth: selectedDepth, sortBy,
        }),
      });
      const revData = await revRes.json();
      if (!revRes.ok) { setError(revData.error); setLoading(false); return; }

      if (revData.taskStatus === "completed" || revData.fromCache) {
        setReviews(revData.reviews);
        setTotalReviews(revData.total);
        setOffset(0);
        setLoading(false);
        setRefreshing(false);
      } else if (revData.taskId) {
        reviewsPolling.setTaskDepth(selectedDepth);
        reviewsPolling.setTaskCreatedAt(new Date().toISOString());
        reviewsPolling.pollTaskStatus(revData.taskId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wystąpił błąd");
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    fetchData(url.trim());
  };

  const handleRefreshBusiness = async () => {
    if (!cid) return;
    setRefreshing(true);
    setError(null);
    try {
      const bizRes = await fetch("/api/business-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cid, refresh: true, mapsUrl: url.trim() || undefined,
          locationName: locationData.selectedCountry, languageCode: locationData.selectedLanguageCode,
        }),
      });
      const bizData = await bizRes.json();
      if (!bizRes.ok) { setError(bizData.error); }
      else {
        setBusiness(bizData.business);
        setFromCache(false);
        if (bizData.asyncTaskId) bizPolling.pollBusinessInfo(bizData.asyncTaskId, bizData.asyncDbTaskId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wystąpił błąd");
    } finally {
      setRefreshing(false);
      fetchCosts();
    }
  };

  const handleFetchReviews = async () => {
    if (!cid) return;
    setLoading(true);
    setError(null);
    reviewsPolling.setTaskStatus(null);
    try {
      const revRes = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cid, refresh: true, offset: 0, limit: LIMIT,
          languageName: locationData.selectedLanguage, locationName: locationData.selectedCountry, depth: selectedDepth, sortBy,
        }),
      });
      const revData = await revRes.json();
      if (!revRes.ok) { setError(revData.error); setLoading(false); }
      else if (revData.taskStatus === "completed" || revData.fromCache) {
        setReviews(revData.reviews);
        setTotalReviews(revData.total);
        setOffset(0);
        setLoading(false);
      } else if (revData.taskId) {
        reviewsPolling.setTaskDepth(selectedDepth);
        reviewsPolling.setTaskCreatedAt(new Date().toISOString());
        reviewsPolling.pollTaskStatus(revData.taskId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wystąpił błąd");
      setLoading(false);
    }
  };

  const handlePageChange = async (newOffset: number) => {
    if (!cid) return;
    setOffset(newOffset);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cid, offset: newOffset, limit: LIMIT }),
    });
    const data = await res.json();
    if (res.ok && data.reviews) {
      setReviews(data.reviews);
      setTotalReviews(data.total);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Pobieranie opinii</h1>
        {totalCost !== null && (
          <span className="text-xs text-gray-400">
            Łączny koszt API: <span className="font-semibold text-gray-600">${totalCost.toFixed(4)}</span>
          </span>
        )}
      </div>

        <div className="flex gap-3 mb-4">
          {/* Location autocomplete */}
          <div className="relative" ref={locationDropRef}>
            <label className="block text-xs text-gray-500 mb-1">Lokalizacja</label>
            <input
              type="text"
              value={locationQuery}
              onChange={(e) => { setLocationQuery(e.target.value); setShowLocationDrop(true); setLocationActive(-1); }}
              onFocus={() => setShowLocationDrop(true)}
              onKeyDown={handleLocationKeyDown}
              placeholder="Wpisz kraj..."
              className="border rounded px-3 py-1.5 text-sm w-52"
            />
            {showLocationDrop && filteredLocations.length > 0 && (
              <ul className="absolute z-50 bg-white border rounded shadow-lg mt-1 max-h-60 overflow-auto w-64">
                {filteredLocations.map((c, i) => (
                  <li
                    key={c.code}
                    onClick={() => { locationData.handleCountryChange(c.name); setLocationQuery(c.name); setShowLocationDrop(false); setLocationActive(-1); }}
                    className={`px-3 py-1.5 text-sm cursor-pointer hover:bg-blue-50 ${i === locationActive ? "bg-blue-100" : c.name === locationData.selectedCountry ? "bg-blue-50 font-medium" : ""}`}
                  >
                    {c.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Language autocomplete */}
          <div className="relative" ref={langDropRef}>
            <label className="block text-xs text-gray-500 mb-1">Język</label>
            <input
              type="text"
              value={langQuery}
              onChange={(e) => { setLangQuery(e.target.value); setShowLangDrop(true); setLangActive(-1); }}
              onFocus={() => setShowLangDrop(true)}
              onKeyDown={handleLangKeyDown}
              placeholder="Wpisz język..."
              className="border rounded px-3 py-1.5 text-sm w-40"
            />
            {showLangDrop && filteredLanguages.length > 0 && (
              <ul className="absolute z-50 bg-white border rounded shadow-lg mt-1 max-h-60 overflow-auto w-52">
                {filteredLanguages.map((lang, i) => (
                  <li
                    key={lang.code}
                    onClick={() => { locationData.handleLanguageChange(lang.name); setLangQuery(lang.name); setShowLangDrop(false); setLangActive(-1); }}
                    className={`px-3 py-1.5 text-sm cursor-pointer hover:bg-blue-50 ${i === langActive ? "bg-blue-100" : lang.name === locationData.selectedLanguage ? "bg-blue-50 font-medium" : ""}`}
                  >
                    {lang.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Głębokość (opinii, max 4490)</label>
            <input
              type="number" min={10} max={4490} step={10}
              value={selectedDepth}
              onChange={(e) => setSelectedDepth(Math.min(4490, Math.max(10, Number(e.target.value))))}
              className="border rounded px-3 py-1.5 text-sm w-28"
            />
            <div className="text-xs text-gray-400 mt-1">
              {Math.ceil(selectedDepth / 10)} SERP &times; $0.002 = ~${(Math.ceil(selectedDepth / 10) * 0.002).toFixed(4)}
            </div>
            <div className="text-xs text-amber-600 mt-0.5">
              Opłata za każde 10 opinii (1 SERP)
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sortowanie</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="border rounded px-3 py-1.5 text-sm"
            >
              <option value="newest">Najnowsze</option>
              <option value="highest_rating">Najwyższa ocena</option>
              <option value="lowest_rating">Najniższa ocena</option>
              <option value="relevant">Trafność</option>
            </select>
          </div>
        </div>

      <form onSubmit={handleSubmit} className="flex gap-3 mb-6">
        <input
          type="text" value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="Wklej URL wizytówki Google Maps..."
          className="flex-1 border rounded-lg px-4 py-2 text-sm" required
        />
        <button
          type="submit" disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Ładowanie..." : "Pobierz opinie"}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">{error}</div>
      )}

      {reviewsPolling.taskStatus === "pending" && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-4 py-3 mb-6 text-sm">
          <div className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Zadanie dodane do kolejki DataForSEO. Wyniki pojawią się automatycznie (~1–5 min).</span>
          </div>
          <div className="mt-1 ml-6 text-blue-500 text-xs flex gap-4">
            {reviewsPolling.taskDepth != null && <span>Głębokość: <strong>{reviewsPolling.taskDepth}</strong> opinii</span>}
            {reviewsPolling.taskCreatedAt && (
              <span>Oczekiwanie: <strong>{Math.floor((reviewsPolling.now - new Date(reviewsPolling.taskCreatedAt).getTime()) / 1000)}s</strong></span>
            )}
          </div>
        </div>
      )}

      {business && (
        <>
          <BusinessCard
            business={business} fromCache={fromCache}
            onRefreshBusiness={handleRefreshBusiness} onFetchReviews={handleFetchReviews}
            isRefreshingBusiness={refreshing}
            isFetchingReviews={loading && reviewsPolling.taskStatus === "pending"}
            asyncPending={bizPolling.asyncPending}
          />
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Opinie</h3>
            {cid && <ExportButtons cid={cid} disabled={reviews.length === 0} />}
          </div>
          <ReviewsTable reviews={reviews} total={totalReviews} offset={offset} limit={LIMIT} onPageChange={handlePageChange} />
        </>
      )}
    </div>
  );
}
