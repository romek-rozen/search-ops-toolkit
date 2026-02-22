"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SearchExportBar from "./SearchExportBar";

export interface SearchResult {
  id: string;
  rankAbsolute: number;
  title: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  domain?: string | null;
  url?: string | null;
  cid?: string | null;
  placeId?: string | null;
  rating?: number | null;
  votesCount?: number | null;
  category?: string | null;
  additionalCategories?: string[];
  isClaimed?: boolean | null;
  snippet?: string | null;
  mainImage?: string | null;
  type?: string | null;
}

interface BatchTaskStatus {
  [cid: string]: "idle" | "pending" | "completed" | "failed";
}

interface Props {
  results: SearchResult[];
  onBatchFetchReviews: (items: SearchResult[]) => void;
  batchStatus: BatchTaskStatus;
  batchLoading: boolean;
  taskId?: string | null;
  batchDepth: number;
  onBatchDepthChange: (depth: number) => void;
  batchSortBy: string;
  onBatchSortByChange: (sortBy: string) => void;
}

type SortKey = "rankAbsolute" | "title" | "rating" | "votesCount" | "category";

export default function SearchResults({ results, onBatchFetchReviews, batchStatus, batchLoading, taskId, batchDepth, onBatchDepthChange, batchSortBy, onBatchSortByChange }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("rankAbsolute");
  const [sortAsc, setSortAsc] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchSaveResult, setBatchSaveResult] = useState<string | null>(null);
  const router = useRouter();

  // Create Business from search result data and navigate to details page
  const handleDetailsClick = async (cid: string) => {
    setLoadingDetails(cid);
    try {
      const res = await fetch("/api/business/create-from-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid }),
      });
      if (res.ok) {
        router.push(`/business/${cid}`);
      }
    } finally {
      setLoadingDetails(null);
    }
  };

  // Batch save selected businesses to DB from search results
  const handleBatchSave = async () => {
    const cids = selectedItems.map(r => r.cid).filter(Boolean) as string[];
    if (cids.length === 0) return;
    setBatchSaving(true);
    setBatchSaveResult(null);
    try {
      const res = await fetch("/api/business/create-from-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cids }),
      });
      if (res.ok) {
        const data = await res.json();
        setBatchSaveResult(`Zapisano ${data.created} nowych firm (${data.businesses.length} łącznie)`);
      }
    } finally {
      setBatchSaving(false);
    }
  };

  const toggleAll = () => {
    if (selected.size === results.filter((r) => r.cid).length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.filter((r) => r.cid).map((r) => r.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const sorted = [...results].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return sortAsc ? cmp : -cmp;
  });

  const selectedItems = results.filter((r) => selected.has(r.id) && r.cid);
  const allWithCid = results.filter((r) => r.cid);

  const SortHeader = ({ col, label, className }: { col: SortKey; label: string; className?: string }) => (
    <th
      className={`sortable ${className || ""}`}
      onClick={() => handleSort(col)}
    >
      {label} {sortKey === col ? (sortAsc ? "↑" : "↓") : ""}
    </th>
  );

  const getStatusBadge = (cid: string | null | undefined) => {
    if (!cid) return null;
    const status = batchStatus[cid];
    if (!status || status === "idle") return null;
    const colors = {
      pending: "badge badge-yellow",
      completed: "badge badge-green",
      failed: "badge badge-red",
    };
    const labels = { pending: "Pobieranie...", completed: "Pobrano", failed: "Błąd" };
    return (
      <span className={colors[status]}>
        {status === "pending" && (
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {labels[status]}
      </span>
    );
  };

  return (
    <div>
      <SearchExportBar results={results} taskId={taskId} />

      {/* Batch actions toolbar */}
      {selected.size > 0 && (
        <div className="bg-brand-50 border border-brand-200 rounded-lg px-4 py-3 mb-4 flex items-center gap-4">
          <span className="text-sm text-brand-700 font-medium">
            Zaznaczono: {selected.size} z {allWithCid.length}
          </span>
          <button
            onClick={handleBatchSave}
            disabled={batchSaving}
            className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {batchSaving ? "Zapisywanie..." : "Dodaj firmy do bazy"}
          </button>
          <div className="flex items-center gap-2">
            <input
              type="number" min={10} max={4490} step={10}
              value={batchDepth}
              onChange={(e) => onBatchDepthChange(Math.min(4490, Math.max(10, Number(e.target.value))))}
              className="border rounded px-2 py-1 text-sm w-20"
              title="Głębokość (max 4490 opinii)"
            />
            <select
              value={batchSortBy}
              onChange={(e) => onBatchSortByChange(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="newest">Najnowsze</option>
              <option value="highest_rating">Najwyższa ocena</option>
              <option value="lowest_rating">Najniższa ocena</option>
              <option value="relevant">Trafność</option>
            </select>
            <button
              onClick={() => onBatchFetchReviews(selectedItems)}
              disabled={batchLoading}
              className="btn-primary text-sm py-1.5 px-4"
            >
              {batchLoading ? "Wysyłanie..." : "Pobierz opinie zaznaczonych"}
            </button>
          </div>
          <span className="text-xs text-amber-600" title="Opłata za każde 10 opinii (1 SERP)">
            {Math.ceil(batchDepth / 10)} SERP &times; $0.002 = ~${(Math.ceil(batchDepth / 10) * 0.002).toFixed(4)} / firma
          </span>
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Odznacz wszystko
          </button>
          {batchSaveResult && (
            <span className="text-sm text-green-700">{batchSaveResult}</span>
          )}
        </div>
      )}

      <div className="table-scroll-container">
        <table className="data-table min-w-[1100px]">
          <thead>
            <tr>
              <th className="col-sticky w-10" style={{ left: 0 }}>
                <input
                  type="checkbox"
                  checked={selected.size === allWithCid.length && allWithCid.length > 0}
                  onChange={toggleAll}
                  className="rounded"
                />
              </th>
              <SortHeader col="rankAbsolute" label="#" className="col-sticky w-12" />
              <SortHeader col="title" label="Nazwa" className="col-sticky" />
              <th>Adres</th>
              <th>Miasto</th>
              <th>Kraj</th>
              <SortHeader col="rating" label="Ocena" className="w-20" />
              <SortHeader col="votesCount" label="Opinii" className="w-20" />
              <SortHeader col="category" label="Kategoria" />
              <th>Dod. kategorie</th>
              <th>Zweryfikowana</th>
              <th>Place ID</th>
              <th>Telefon</th>
              <th>Status</th>
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id}>
                <td className="col-sticky" style={{ left: 0 }}>
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggleOne(r.id)}
                    disabled={!r.cid}
                    className="rounded disabled:opacity-30"
                    title={r.cid ? undefined : "Brak CID — nie można pobrać opinii"}
                  />
                </td>
                <td className="col-sticky text-slate-400" style={{ left: '2.5rem' }}>{r.rankAbsolute}</td>
                <td className="col-sticky" style={{ left: '5.5rem' }}>
                  {r.cid ? (
                    <button
                      onClick={() => handleDetailsClick(r.cid!)}
                      disabled={loadingDetails === r.cid}
                      className="font-medium text-slate-900 hover:text-brand-600 text-left disabled:opacity-50"
                    >
                      {r.title}
                      {r.type === "maps_paid_item" && <span className="ml-1.5 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 align-middle">(Reklama)</span>}
                    </button>
                  ) : (
                    <div className="font-medium text-slate-900">
                      {r.title}
                      {r.type === "maps_paid_item" && <span className="ml-1.5 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 align-middle">(Reklama)</span>}
                    </div>
                  )}
                  {r.domain && <div className="text-xs text-slate-400">{r.domain}</div>}
                </td>
                <td className="text-slate-500 text-xs max-w-48 truncate">{r.address || "—"}</td>
                <td className="text-slate-500 text-xs">{r.city || "—"}</td>
                <td className="text-slate-500 text-xs">{r.country || "—"}</td>
                <td>
                  {r.rating != null ? (
                    <span><span className="text-amber-400">★</span> {r.rating.toFixed(1)}</span>
                  ) : "—"}
                </td>
                <td className="text-slate-600">{r.votesCount ?? "—"}</td>
                <td className="text-slate-500 text-xs">{r.category || "—"}</td>
                <td className="text-slate-500 text-xs">
                  {r.additionalCategories && r.additionalCategories.length > 0
                    ? r.additionalCategories.join(", ")
                    : "—"}
                </td>
                <td className="text-xs">
                  {r.isClaimed == null ? "—" : r.isClaimed
                    ? <span className="text-green-600">Tak</span>
                    : <span className="text-slate-400">Nie</span>}
                </td>
                <td className="text-slate-400 text-xs font-mono">{r.placeId || "—"}</td>
                <td className="text-slate-500 text-xs">{r.phone || "—"}</td>
                <td>{getStatusBadge(r.cid)}</td>
                <td className="text-right">
                  {r.cid && (
                    <button
                      onClick={() => handleDetailsClick(r.cid!)}
                      disabled={loadingDetails === r.cid}
                      className="text-brand-600 hover:text-brand-800 text-xs disabled:opacity-50"
                    >
                      {loadingDetails === r.cid ? "Ładowanie…" : "Szczegóły"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-xs text-slate-400">
        Wyników: {results.length}
      </div>
    </div>
  );
}
