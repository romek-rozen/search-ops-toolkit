"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ShareButton from "@/components/ShareButton";

interface ReviewTaskRow {
  id: string;
  businessName: string;
  businessCid: string;
  status: string;
  depth: number;
  reviewsCount: number;
  cost: number | null;
  locationName: string | null;
  languageName: string | null;
  dfsLogin: string | null;
  isShared: boolean;
  createdAt: string;
}

type SortKey = keyof ReviewTaskRow;
type SortDir = "asc" | "desc";

export default function ReviewsHistoryPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<ReviewTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [currentLogin, setCurrentLogin] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/reviews/history")
      .then((r) => r.json())
      .then((data) => setTasks(data.tasks || []))
      .finally(() => setLoading(false));
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setCurrentLogin(data.login || null))
      .catch(() => {});
  }, []);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await fetch("/api/reviews/history", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setDeleting(null);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = [...tasks].sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const statusBadge = (status: string) => {
    const cls =
      status === "completed"
        ? "bg-green-100 text-green-700"
        : status === "failed"
        ? "bg-red-100 text-red-700"
        : "bg-yellow-100 text-yellow-700";
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>
        {status}
      </span>
    );
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  const th = (label: string, col: SortKey, className = "") => (
    <th
      className={`text-left px-4 py-2 font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900 ${className}`}
      onClick={() => toggleSort(col)}
    >
      {label}
      <SortIcon col={col} />
    </th>
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Historia opinii</h1>

      {loading ? (
        <p className="text-gray-500">Ładowanie...</p>
      ) : tasks.length === 0 ? (
        <p className="text-gray-500">Brak tasków opinii.</p>
      ) : (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                {th("Firma", "businessName")}
                {th("Lokalizacja", "locationName")}
                {th("Język", "languageName")}
                {th("Głębokość", "depth", "w-24")}
                {th("Opinie", "reviewsCount", "w-20")}
                {th("Koszt", "cost", "w-24")}
                {th("Status", "status", "w-28")}
                {th("Data", "createdAt", "w-28")}
                <th className="w-28 text-left px-4 py-2 font-medium text-gray-600">Share</th>
                <th className="w-36"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr
                  key={t.id}
                  className="border-b last:border-b-0 hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/reviews/task/${t.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-blue-600">
                    {t.businessName}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{t.locationName || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{t.languageName || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{t.depth}</td>
                  <td className="px-4 py-3">{t.reviewsCount ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {t.cost != null && t.cost > 0
                      ? `$${t.cost.toFixed(4)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">{statusBadge(t.status)}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(t.createdAt).toLocaleDateString("pl-PL")}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <ShareButton
                      taskId={t.id}
                      taskType="review"
                      isShared={t.isShared}
                      isOwner={currentLogin === t.dfsLogin}
                    />
                  </td>
                  <td className="px-4 py-3 text-right flex items-center gap-2 justify-end">
                    {t.status === "completed" && t.reviewsCount > 0 && (
                      <>
                        <a
                          href={`/api/reviews/export?taskId=${t.id}&format=csv`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          CSV
                        </a>
                        <a
                          href={`/api/reviews/export?taskId=${t.id}&format=xlsx`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          XLSX
                        </a>
                      </>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(t.id);
                      }}
                      disabled={deleting === t.id}
                      className="text-red-500 hover:text-red-700 disabled:opacity-40 text-xs"
                    >
                      {deleting === t.id ? "..." : "Usuń"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
