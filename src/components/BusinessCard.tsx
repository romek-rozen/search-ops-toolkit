"use client";

import { useState, useEffect } from "react";

interface Business {
  name: string;
  cid?: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  category?: string | null;
  rating?: number | null;
  totalReviews?: number | null;
}

interface InfoTask {
  id: string;
  dfsTaskId: string;
  status: string;
  cost: number | null;
  locationName: string | null;
  languageCode: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

interface NameHistoryEntry {
  id: string;
  name: string;
  source: string;
  recordedAt: string;
}

interface DataHistoryEntry {
  id: string;
  name: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  category: string | null;
  rating: number | null;
  totalReviews: number | null;
  source: string;
  recordedAt: string;
}

interface Props {
  business: Business;
  fromCache: boolean;
  onRefreshBusiness: () => void;
  onFetchReviews: () => void;
  isRefreshingBusiness: boolean;
  isFetchingReviews: boolean;
  asyncPending?: boolean;
}

export default function BusinessCard({ business, fromCache, onRefreshBusiness, onFetchReviews, isRefreshingBusiness, isFetchingReviews, asyncPending }: Props) {
  const [showHistory, setShowHistory] = useState(false);
  const [infoTasks, setInfoTasks] = useState<InfoTask[]>([]);
  const [nameHistory, setNameHistory] = useState<NameHistoryEntry[]>([]);
  const [dataHistory, setDataHistory] = useState<DataHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const isUnknown = business.name === "Nieznana firma";

  useEffect(() => {
    if (!showHistory || !business.cid) return;
    setHistoryLoading(true);
    fetch("/api/business-info/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cid: business.cid }),
    })
      .then((r) => r.json())
      .then((data) => {
        setInfoTasks(data.tasks || []);
        setNameHistory(data.nameHistory || []);
        setDataHistory(data.dataHistory || []);
      })
      .finally(() => setHistoryLoading(false));
  }, [showHistory, business.cid]);

  const statusLabel = (status: string) => {
    const map: Record<string, { text: string; cls: string }> = {
      pending: { text: "Oczekuje", cls: "bg-yellow-100 text-yellow-700" },
      ready: { text: "Gotowy", cls: "bg-blue-100 text-blue-700" },
      completed: { text: "Ukończony", cls: "bg-green-100 text-green-700" },
      failed: { text: "Błąd", cls: "bg-red-100 text-red-700" },
    };
    const s = map[status] || { text: status, cls: "bg-gray-100 text-gray-600" };
    return <span className={`text-xs px-1.5 py-0.5 rounded ${s.cls}`}>{s.text}</span>;
  };

  return (
    <div className="bg-white rounded-lg border p-5 mb-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-bold">
            {isUnknown && business.cid
              ? `CID: ${business.cid}`
              : business.name}
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            {business.category && (
              <span className="text-sm text-gray-500">{business.category}</span>
            )}
            {business.cid && !isUnknown && (
              <span className="text-xs text-gray-300 font-mono">CID: {business.cid}</span>
            )}
          </div>
          {asyncPending && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-blue-600">
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Pobieranie danych o firmie (async)...
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {fromCache && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
              z cache
            </span>
          )}
          <button
            onClick={() => setShowHistory((h) => !h)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            {showHistory ? "Ukryj historię" : "Historia"}
          </button>
          <button
            onClick={onRefreshBusiness}
            disabled={isRefreshingBusiness}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            {isRefreshingBusiness ? "Odświeżanie..." : "Odśwież dane o firmie"}
          </button>
          <button
            onClick={onFetchReviews}
            disabled={isFetchingReviews}
            className="text-sm text-green-600 hover:text-green-800 disabled:opacity-50"
          >
            {isFetchingReviews ? "Pobieranie..." : "Pobierz opinie"}
          </button>
        </div>
      </div>

      <div className="mt-3 flex gap-6 text-sm text-gray-600">
        {business.rating != null && (
          <div>
            <span className="font-semibold text-yellow-600">
              {"★".repeat(Math.round(business.rating))}
            </span>{" "}
            {business.rating.toFixed(1)}
            {business.totalReviews != null && (
              <span className="text-gray-400"> ({business.totalReviews} opinii)</span>
            )}
          </div>
        )}
        {business.address && <div>{business.address}</div>}
      </div>

      <div className="mt-2 flex gap-6 text-sm text-gray-500">
        {business.phone && <div>{business.phone}</div>}
        {business.website && (
          <a
            href={business.website.startsWith("http") ? business.website : `https://${business.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            {business.website}
          </a>
        )}
      </div>

      {/* Historia sprawdzeń */}
      {showHistory && (
        <div className="mt-4 border-t pt-3">
          {historyLoading ? (
            <p className="text-xs text-gray-400">Ładowanie historii...</p>
          ) : (
            <>
              {nameHistory.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-xs font-semibold text-gray-500 mb-1">Historia nazw</h4>
                  <div className="space-y-1">
                    {nameHistory.map((h) => (
                      <div key={h.id} className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="font-medium text-gray-700">{h.name}</span>
                        <span className="text-gray-300">&middot;</span>
                        <span>{h.source}</span>
                        <span className="text-gray-300">&middot;</span>
                        <span>{new Date(h.recordedAt).toLocaleString("pl-PL")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dataHistory.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-xs font-semibold text-gray-500 mb-1">Historia danych firmy</h4>
                  <div className="space-y-2">
                    {dataHistory.map((d, i) => {
                      const prev = dataHistory[i + 1];
                      const changed = (field: keyof DataHistoryEntry) =>
                        prev && d[field] !== prev[field];
                      return (
                        <div key={d.id} className="text-xs text-gray-500 border-l-2 border-gray-200 pl-2">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-gray-400">{new Date(d.recordedAt).toLocaleString("pl-PL")}</span>
                            <span className="text-gray-300">({d.source})</span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                            {d.name && (
                              <span className={changed("name") ? "text-orange-600 font-medium" : ""}>
                                {d.name}
                              </span>
                            )}
                            {d.rating != null && (
                              <span className={changed("rating") ? "text-orange-600 font-medium" : ""}>
                                {"★"} {d.rating.toFixed(1)}
                                {d.totalReviews != null && ` (${d.totalReviews})`}
                              </span>
                            )}
                            {d.address && (
                              <span className={changed("address") ? "text-orange-600 font-medium" : ""}>
                                {d.address}
                              </span>
                            )}
                            {d.phone && (
                              <span className={changed("phone") ? "text-orange-600 font-medium" : ""}>
                                {d.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {infoTasks.length > 0 ? (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 mb-1">Sprawdzenia Business Info</h4>
                  <div className="space-y-1">
                    {infoTasks.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-xs text-gray-500">
                        {statusLabel(t.status)}
                        {t.locationName && <span>{t.locationName}</span>}
                        {t.languageCode && <span className="text-gray-300">({t.languageCode})</span>}
                        {t.cost != null && t.cost > 0 && (
                          <span className="text-gray-400">${t.cost.toFixed(4)}</span>
                        )}
                        {t.error && (
                          <span className="text-red-400 truncate max-w-xs" title={t.error}>
                            {t.error}
                          </span>
                        )}
                        <span className="text-gray-300 ml-auto">
                          {new Date(t.createdAt).toLocaleString("pl-PL")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400">Brak sprawdzeń business info.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
