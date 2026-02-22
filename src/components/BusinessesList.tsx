"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Business {
  id: string;
  cid: string;
  name: string;
  address?: string | null;
  category?: string | null;
  rating?: number | null;
  totalReviews?: number | null;
  updatedAt: string;
  _count: { reviews: number };
  totalCost: number;
}

interface BusinessesListProps {
  onSelectBusiness?: (cid: string) => void;
}

export default function BusinessesList({ onSelectBusiness }: BusinessesListProps) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((data) => setBusinesses(data.businesses || []))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await fetch("/api/history", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBusinesses((prev) => prev.filter((b) => b.id !== id));
    setDeleting(null);
  };

  if (loading) {
    return <p className="text-gray-500">Ładowanie...</p>;
  }

  if (businesses.length === 0) {
    return <p className="text-gray-500">Brak pobranych firm.</p>;
  }

  return (
    <div className="bg-white rounded-lg border overflow-x-auto">
      <table className="w-full text-sm min-w-[600px]">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-2 font-medium text-gray-600">Firma</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600 w-44">CID</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600">Kategoria</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600 w-20">Ocena</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600 w-28">Opinii w DB</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600 w-36">Ostatnia aktualizacja</th>
            <th className="text-right px-4 py-2 font-medium text-gray-600 w-24">Koszt API</th>
            <th className="w-32"></th>
          </tr>
        </thead>
        <tbody>
          {businesses.map((b) => (
            <tr key={b.id} className="border-b last:border-b-0 hover:bg-gray-50">
              <td className="px-4 py-3">
                <Link href={`/business/${b.cid}`} className="font-medium text-blue-600 hover:text-blue-800 hover:underline">
                  {b.name === "Nieznana firma" ? `CID: ${b.cid}` : b.name}
                </Link>
                {b.address && (
                  <div className="text-xs text-gray-400">{b.address}</div>
                )}
              </td>
              <td className="px-4 py-3 text-gray-400 text-xs font-mono">{b.cid}</td>
              <td className="px-4 py-3 text-gray-500">{b.category || "—"}</td>
              <td className="px-4 py-3">
                {b.rating != null ? (
                  <span className="text-yellow-600">{b.rating.toFixed(1)} ★</span>
                ) : "—"}
              </td>
              <td className="px-4 py-3">{b._count.reviews}</td>
              <td className="px-4 py-3 text-gray-500">
                {new Date(b.updatedAt).toLocaleDateString("pl-PL")}
              </td>
              <td className="px-4 py-3 text-right text-gray-500">
                {b.totalCost > 0 ? `$${b.totalCost.toFixed(4)}` : "—"}
              </td>
              <td className="px-4 py-3 text-right flex gap-2 justify-end">
                {onSelectBusiness && (
                  <button
                    onClick={() => onSelectBusiness(b.cid)}
                    className="text-green-600 hover:text-green-800 text-xs"
                  >
                    Opinie
                  </button>
                )}
                <Link
                  href={`/business/${b.cid}`}
                  className="text-blue-600 hover:text-blue-800 text-xs"
                >
                  Szczegóły
                </Link>
                <button
                  onClick={() => handleDelete(b.id)}
                  disabled={deleting === b.id}
                  className="text-red-500 hover:text-red-700 disabled:opacity-40 text-xs"
                >
                  {deleting === b.id ? "..." : "Usuń"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
