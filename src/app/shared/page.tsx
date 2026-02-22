"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ShareButton from "@/components/ShareButton";

interface SharedReviewTask {
  id: string;
  status: string;
  depth: number;
  cost: number | null;
  locationName: string | null;
  languageName: string | null;
  dfsLogin: string | null;
  createdAt: string;
  business: { name: string; cid: string };
  _count: { reviews: number };
}

interface SharedSearchTask {
  id: string;
  keyword: string;
  locationName: string;
  method: string;
  depth: number;
  status: string;
  resultsCount: number | null;
  cost: number | null;
  dfsLogin: string | null;
  createdAt: string;
}

type OwnerFilter = "others" | "mine" | "all";
type TypeFilter = "all" | "search" | "review";

export default function SharedPage() {
  const router = useRouter();
  const [reviewTasks, setReviewTasks] = useState<SharedReviewTask[]>([]);
  const [searchTasks, setSearchTasks] = useState<SharedSearchTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("others");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [currentLogin, setCurrentLogin] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/shared?owner=${ownerFilter}&type=${typeFilter}`)
      .then((r) => r.json())
      .then((data) => {
        setReviewTasks(data.reviewTasks || []);
        setSearchTasks(data.searchTasks || []);
      })
      .finally(() => setLoading(false));
  }, [ownerFilter, typeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setCurrentLogin(d.login || null))
      .catch(() => {});
  }, []);

  const statusBadge = (status: string) => {
    const cls =
      status === "completed"
        ? "bg-green-100 text-green-700"
        : status === "failed"
        ? "bg-red-100 text-red-700"
        : "bg-yellow-100 text-yellow-700";
    return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{status}</span>;
  };

  const chip = (
    label: string,
    active: boolean,
    onClick: () => void,
  ) => (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );

  const empty = reviewTasks.length === 0 && searchTasks.length === 0;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Udostepnione</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Czyje:</span>
          {chip("Od innych", ownerFilter === "others", () => setOwnerFilter("others"))}
          {chip("Moje", ownerFilter === "mine", () => setOwnerFilter("mine"))}
          {chip("Wszystkie", ownerFilter === "all", () => setOwnerFilter("all"))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Typ:</span>
          {chip("Wszystko", typeFilter === "all", () => setTypeFilter("all"))}
          {chip("Wyszukiwania", typeFilter === "search", () => setTypeFilter("search"))}
          {chip("Opinie", typeFilter === "review", () => setTypeFilter("review"))}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Ladowanie...</p>
      ) : empty ? (
        <p className="text-gray-500">Brak udostepnionych taskow dla wybranych filtrow.</p>
      ) : (
        <>
          {/* Search tasks */}
          {searchTasks.length > 0 && (
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-gray-600 mb-3">
                Wyszukiwania ({searchTasks.length})
              </h2>
              <div className="bg-white rounded-lg border overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Fraza</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Lokalizacja</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Wyniki</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Status</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Autor</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Data</th>
                      {ownerFilter === "mine" && (
                        <th className="text-left px-4 py-2 font-medium text-gray-600 w-28">Share</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {searchTasks.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b last:border-b-0 hover:bg-gray-50 cursor-pointer"
                        onClick={() => router.push(`/search?taskId=${t.id}`)}
                      >
                        <td className="px-4 py-3 font-medium text-blue-600">{t.keyword}</td>
                        <td className="px-4 py-3 text-gray-500">{t.locationName}</td>
                        <td className="px-4 py-3">{t.resultsCount ?? "—"}</td>
                        <td className="px-4 py-3">{statusBadge(t.status)}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{t.dfsLogin}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(t.createdAt).toLocaleDateString("pl-PL")}
                        </td>
                        {ownerFilter === "mine" && (
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <ShareButton
                              taskId={t.id}
                              taskType="mapsSearch"
                              isShared={true}
                              isOwner={currentLogin === t.dfsLogin}
                              onChange={(shared) => {
                                if (!shared) setSearchTasks((prev) => prev.filter((x) => x.id !== t.id));
                              }}
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Review tasks */}
          {reviewTasks.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-600 mb-3">
                Opinie ({reviewTasks.length})
              </h2>
              <div className="bg-white rounded-lg border overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Firma</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Opinie</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Status</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Autor</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Data</th>
                      {ownerFilter === "mine" && (
                        <th className="text-left px-4 py-2 font-medium text-gray-600 w-28">Share</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {reviewTasks.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b last:border-b-0 hover:bg-gray-50 cursor-pointer"
                        onClick={() => router.push(`/reviews/task/${t.id}`)}
                      >
                        <td className="px-4 py-3 font-medium text-blue-600">{t.business.name}</td>
                        <td className="px-4 py-3">{t._count.reviews}</td>
                        <td className="px-4 py-3">{statusBadge(t.status)}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{t.dfsLogin}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(t.createdAt).toLocaleDateString("pl-PL")}
                        </td>
                        {ownerFilter === "mine" && (
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <ShareButton
                              taskId={t.id}
                              taskType="review"
                              isShared={true}
                              isOwner={currentLogin === t.dfsLogin}
                              onChange={(shared) => {
                                if (!shared) setReviewTasks((prev) => prev.filter((x) => x.id !== t.id));
                              }}
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
