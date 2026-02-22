"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Business {
  id: string;
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
  updatedAt: string;
  _count: { reviews: number; tasks: number };
}

type SortKey = "name" | "rating" | "totalReviews" | "updatedAt" | "category";

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    fetch("/api/businesses")
      .then((r) => r.json())
      .then((data) => setBusinesses(data.businesses || []))
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const filtered = businesses.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      (b.address?.toLowerCase().includes(q)) ||
      (b.category?.toLowerCase().includes(q)) ||
      b.cid.includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return sortAsc ? cmp : -cmp;
  });

  const SortHeader = ({ col, label, className }: { col: SortKey; label: string; className?: string }) => (
    <th
      className={`sortable ${className || ""}`}
      onClick={() => handleSort(col)}
    >
      {label} {sortKey === col ? (sortAsc ? "↑" : "↓") : ""}
    </th>
  );

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Firmy</h1>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Szukaj po nazwie, adresie, kategorii lub CID..."
          className="form-input w-full max-w-md"
        />
      </div>

      {loading ? (
        <p className="text-gray-500">Ładowanie...</p>
      ) : businesses.length === 0 ? (
        <p className="text-gray-500">Brak firm w bazie. Firmy pojawią się po pobraniu opinii.</p>
      ) : (
        <>
          <div className="table-scroll-container">
            <table className="data-table min-w-[800px]">
              <thead>
                <tr>
                  <SortHeader col="name" label="Nazwa" className="col-sticky" />
                  <th>Adres</th>
                  <th>Miasto</th>
                  <th>Kraj</th>
                  <SortHeader col="category" label="Kategoria" />
                  <SortHeader col="rating" label="Ocena" className="w-20" />
                  <SortHeader col="totalReviews" label="Opinii" className="w-20" />
                  <th className="w-20">W bazie</th>
                  <SortHeader col="updatedAt" label="Aktualizacja" className="w-32" />
                  <th>CID</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((b) => (
                  <tr key={b.id}>
                    <td className="col-sticky" style={{ left: 0 }}>
                      <Link href={`/business/${b.cid}`} className="font-medium text-brand-600 hover:text-brand-800">
                        {b.name}
                      </Link>
                      {b.website && (
                        <div className="text-xs text-slate-400 truncate max-w-48">{b.website}</div>
                      )}
                    </td>
                    <td className="text-slate-500 text-xs max-w-56 truncate">{b.address || "—"}</td>
                    <td className="text-slate-500 text-xs">{b.city || "—"}</td>
                    <td className="text-slate-500 text-xs">{b.country || "—"}</td>
                    <td className="text-slate-500 text-xs">{b.category || "—"}</td>
                    <td>
                      {b.rating != null ? (
                        <span><span className="text-amber-400">★</span> {b.rating.toFixed(1)}</span>
                      ) : "—"}
                    </td>
                    <td className="text-slate-600">{b.totalReviews ?? "—"}</td>
                    <td className="text-slate-500 text-xs">{b._count.reviews}</td>
                    <td className="text-slate-500 text-xs">
                      {new Date(b.updatedAt).toLocaleDateString("pl-PL")}
                    </td>
                    <td className="text-slate-400 text-xs font-mono select-all">{b.cid}</td>
                    <td>
                      <Link
                        href={`/business/${b.cid}`}
                        className="text-brand-600 hover:text-brand-800 text-xs"
                      >
                        →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            {filtered.length === businesses.length
              ? `Firm: ${businesses.length}`
              : `${filtered.length} z ${businesses.length}`}
          </div>
        </>
      )}
    </div>
  );
}
