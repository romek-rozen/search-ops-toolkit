"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import BusinessDetailCard from "@/components/BusinessDetailCard";
import ReviewTasksTable from "@/components/ReviewTasksTable";
import InfoTasksTable from "@/components/InfoTasksTable";
import CostsSummary from "@/components/CostsSummary";
import { useLocationData } from "@/hooks/useLocationData";
import { useTaskStream } from "@/hooks/useTaskStream";

interface ReviewTask {
  id: string;
  status: string;
  depth: number;
  cost: number | null;
  timeSec: string | null;
  locationName: string | null;
  languageName: string | null;
  error: string | null;
  createdAt: string;
  _count?: { reviews: number };
}

interface InfoTask {
  id: string;
  status: string;
  cost: number | null;
  timeSec: string | null;
  locationName: string | null;
  languageCode: string | null;
  error: string | null;
  createdAt: string;
}

interface DetailData {
  business: {
    cid: string;
    name: string;
    address?: string | null;
    city?: string | null;
    country?: string | null;
    phone?: string | null;
    website?: string | null;
    category?: string | null;
    rating?: number | null;
    totalReviews?: number | null;
    mapsUrl?: string | null;
    updatedAt: string;
    _count: { reviews: number };
  };
  additionalCategories: string[];
  reviewTasks: ReviewTask[];
  infoTasks: InfoTask[];
  costs: { reviewTasks: number; infoTasks: number; total: number };
}

export default function BusinessDetailPage() {
  const { cid } = useParams<{ cid: string }>();
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refresh business info
  const [refreshingBusiness, setRefreshingBusiness] = useState(false);
  const [bizPollingTaskId, setBizPollingTaskId] = useState<string | null>(null);
  const [bizDbTaskId, setBizDbTaskId] = useState<string | null>(null);

  // Business info method
  const [bizMethod, setBizMethod] = useState<"standard" | "priority" | "live">("standard");

  // Fetch reviews
  const [fetchingReviews, setFetchingReviews] = useState(false);
  const [fetchDepth, setFetchDepth] = useState(100);
  const [showFetchForm, setShowFetchForm] = useState(false);
  const [pollingTaskId, setPollingTaskId] = useState<string | null>(null);

  // Language autocomplete
  const locationData = useLocationData({ prefix: "reviews" });
  const [langQuery, setLangQuery] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("reviews_language") || "Polish" : "Polish"
  );
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  // Set fetchDepth based on totalReviews (rounded up to nearest 100, min 100)
  useEffect(() => {
    if (data?.business?.totalReviews) {
      setFetchDepth(Math.max(100, Math.ceil(data.business.totalReviews / 100) * 100));
    }
  }, [data?.business?.totalReviews]);

  const fetchData = useCallback(() => {
    fetch(`/api/business/${cid}`)
      .then((r) => (r.ok ? r.json() : Promise.reject("not found")))
      .then(setData)
      .catch(() => setError("Nie znaleziono firmy"))
      .finally(() => setLoading(false));
  }, [cid]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Close language dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setShowLangDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // SSE: instant notification when postback completes (review or biz-info tasks)
  const sseTaskIds = [pollingTaskId, bizDbTaskId].filter(Boolean) as string[];
  useTaskStream(sseTaskIds, useCallback((event) => {
    if (event.taskId === pollingTaskId) {
      setPollingTaskId(null);
      setFetchingReviews(false);
      fetchData();
    } else if (event.taskId === bizDbTaskId) {
      setBizPollingTaskId(null);
      setBizDbTaskId(null);
      setRefreshingBusiness(false);
      fetchData();
    }
  }, [pollingTaskId, bizDbTaskId, fetchData]));

  // Polling for review task (fallback)
  useEffect(() => {
    if (!pollingTaskId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/reviews/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: pollingTaskId }),
        });
        const result = await res.json();
        if (result.taskStatus === "completed" || result.taskStatus === "failed") {
          clearInterval(interval);
          setPollingTaskId(null);
          setFetchingReviews(false);
          fetchData();
        }
      } catch {
        // continue polling
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [pollingTaskId, fetchData]);

  // Polling for business info task (fallback)
  useEffect(() => {
    if (!bizPollingTaskId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/business-info/task/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dfsTaskId: bizPollingTaskId }),
        });
        const result = await res.json();
        if (result.taskStatus === "completed" || result.taskStatus === "failed") {
          clearInterval(interval);
          setBizPollingTaskId(null);
          setBizDbTaskId(null);
          setRefreshingBusiness(false);
          fetchData();
        }
      } catch {
        // continue polling
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [bizPollingTaskId, fetchData]);

  const handleRefreshBusiness = async () => {
    setRefreshingBusiness(true);
    try {
      const res = await fetch("/api/business-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid, refresh: true, method: bizMethod }),
      });
      const result = await res.json();
      if (result.asyncTaskId) {
        setBizPollingTaskId(result.asyncTaskId);
        if (result.asyncDbTaskId) setBizDbTaskId(result.asyncDbTaskId);
      } else {
        setRefreshingBusiness(false);
      }
      fetchData();
    } catch {
      setRefreshingBusiness(false);
      setError("Błąd podczas odświeżania danych firmy.");
    }
  };

  const handleFetchReviews = async () => {
    setFetchingReviews(true);
    setShowFetchForm(false);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cid,
          refresh: true,
          depth: fetchDepth,
          languageName: locationData.selectedLanguage,
          locationName: locationData.selectedCountry,
        }),
      });
      const result = await res.json();
      if (result.taskId) {
        setPollingTaskId(result.taskId);
        fetchData();
      } else {
        setFetchingReviews(false);
        fetchData();
      }
    } catch {
      setFetchingReviews(false);
      setError("Błąd podczas tworzenia zadania pobierania opinii.");
    }
  };

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto p-6">
        <p className="text-gray-500">Ładowanie...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="max-w-6xl mx-auto p-6">
        <p className="text-red-500">{error}</p>
        <Link href="/history" className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block">
          Powrót do historii
        </Link>
      </main>
    );
  }

  const { business, additionalCategories, reviewTasks, infoTasks, costs } = data;

  const filteredLanguages = locationData.languages.length > 0
    ? locationData.languages.filter((l) => l.name.toLowerCase().includes(langQuery.toLowerCase()))
    : [{ name: "Polish", code: "pl" }, { name: "English", code: "en" }].filter((l) =>
        l.name.toLowerCase().includes(langQuery.toLowerCase())
      );

  return (
    <main className="max-w-6xl mx-auto p-6">
      {/* Navigation */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => window.history.back()} className="text-sm text-blue-600 hover:text-blue-800">
          ← Wstecz
        </button>
        <Link href={`/reviews?prefill=${encodeURIComponent(business.mapsUrl || `https://www.google.com/maps?cid=${cid}`)}`} className="text-sm text-blue-600 hover:text-blue-800">
          Załaduj recenzje
        </Link>
      </div>

      <BusinessDetailCard business={business} additionalCategories={additionalCategories} />
      <CostsSummary reviewTasksCost={costs.reviewTasks} infoTasksCost={costs.infoTasks} totalCost={costs.total} />

      {/* Review Tasks */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-600">
            Pobieranie recenzji ({reviewTasks.length})
          </h2>
          <div className="flex items-center gap-2">
            {showFetchForm && (
              <>
                <select
                  value={fetchDepth}
                  onChange={(e) => setFetchDepth(Number(e.target.value))}
                  className="text-xs border rounded px-2 py-1"
                >
                  <option value={100}>100 opinii</option>
                  <option value={500}>500 opinii</option>
                  <option value={700}>700 opinii</option>
                  <option value={1000}>1000 opinii</option>
                </select>
                {/* Language autocomplete */}
                <div ref={langRef} className="relative">
                  <input
                    type="text"
                    value={langQuery}
                    onChange={(e) => {
                      setLangQuery(e.target.value);
                      setShowLangDropdown(true);
                    }}
                    onFocus={() => setShowLangDropdown(true)}
                    placeholder="Język..."
                    className="text-xs border rounded px-2 py-1 w-28"
                  />
                  {showLangDropdown && (
                    <ul className="absolute z-10 top-full left-0 mt-1 bg-white border rounded shadow-lg max-h-48 overflow-y-auto w-48">
                      {filteredLanguages.slice(0, 8).map((l) => (
                        <li
                          key={l.code}
                          onClick={() => {
                            locationData.handleLanguageChange(l.name);
                            setLangQuery(l.name);
                            setShowLangDropdown(false);
                          }}
                          className={`px-3 py-1.5 text-xs cursor-pointer hover:bg-blue-50 ${
                            l.name === locationData.selectedLanguage ? "bg-blue-50 font-medium" : ""
                          }`}
                        >
                          {l.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
            {showFetchForm && (
              <span className="text-xs text-gray-400" title="$0.00075 / 10 opinii (standard)">
                ~${(fetchDepth * 0.000075).toFixed(4)}
              </span>
            )}
            {showFetchForm ? (
              <div className="flex gap-1">
                <button
                  onClick={handleFetchReviews}
                  disabled={fetchingReviews}
                  className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Start
                </button>
                <button
                  onClick={() => setShowFetchForm(false)}
                  className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700"
                >
                  Anuluj
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowFetchForm(true)}
                disabled={fetchingReviews}
                className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {fetchingReviews ? "Pobieranie..." : "Pobierz opinie"}
              </button>
            )}
          </div>
        </div>
        <ReviewTasksTable tasks={reviewTasks} businessName={business.name} />
      </section>

      {/* Business Info Tasks */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-600">
            Pobieranie danych o firmie ({infoTasks.length})
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={bizMethod}
              onChange={(e) => setBizMethod(e.target.value as "standard" | "priority" | "live")}
              className="text-xs border rounded px-2 py-1"
              disabled={refreshingBusiness}
            >
              <option value="standard">Standard (~45 min) — $0.0015</option>
              <option value="priority">Priority (~1 min) — $0.003</option>
              <option value="live">Live (~6 sek) — $0.0054</option>
            </select>
            <button
              onClick={handleRefreshBusiness}
              disabled={refreshingBusiness}
              className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {refreshingBusiness ? "Odświeżanie..." : "Odśwież"}
            </button>
          </div>
        </div>
        <InfoTasksTable tasks={infoTasks} />
      </section>
    </main>
  );
}
