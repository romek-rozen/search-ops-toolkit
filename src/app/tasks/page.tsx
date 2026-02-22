"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

interface Task {
  id: string;
  type: "review" | "info" | "search";
  dfsTaskId: string | null;
  status: string;
  cost: number | null;
  createdAt: string;
  updatedAt: string;
  businessName: string | null;
  businessCid: string | null;
  keyword: string | null;
  locationName: string | null;
  error: string | null;
  dfsLogin: string | null;
}

interface Summary {
  total: number;
  pending: number;
  completed: number;
  failed: number;
  totalCost: number;
}

// Relative time helper
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "teraz";
  if (mins < 60) return `${mins} min temu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} godz. temu`;
  const days = Math.floor(hours / 24);
  return `${days} dn. temu`;
}

// Shorten ID for display
function shortId(id: string | null): string {
  if (!id) return "—";
  if (id.length <= 12) return id;
  return id.slice(0, 6) + "..." + id.slice(-4);
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  ready: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

const TYPE_STYLES: Record<string, string> = {
  review: "bg-blue-100 text-blue-700",
  info: "bg-purple-100 text-purple-700",
  search: "bg-orange-100 text-orange-700",
};

const TYPE_LABELS: Record<string, string> = {
  review: "Review",
  info: "Info",
  search: "Search",
};

type SortKey = "createdAt" | "status" | "type" | "cost";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryAllLoading, setRetryAllLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortAsc, setSortAsc] = useState(false);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/tasks?${params}`);
      const data = await res.json();
      setTasks(data.tasks || []);
      setSummary(data.summary || null);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    setLoading(true);
    fetchTasks();
  }, [fetchTasks]);

  // Auto-polling: when pending tasks exist, retry-all every 30s + refresh list every 10s
  const retryAllRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const hasPending = tasks.some((t) => t.status === "pending" || t.status === "ready");
    if (!hasPending) {
      if (retryAllRef.current) {
        clearInterval(retryAllRef.current);
        retryAllRef.current = null;
      }
      return;
    }

    // Refresh task list every 10s
    const listInterval = setInterval(fetchTasks, 10000);

    // Auto-retry pending tasks every 30s
    retryAllRef.current = setInterval(async () => {
      try {
        await fetch("/api/tasks/retry-all", { method: "POST" });
        fetchTasks();
      } catch {
        // silent
      }
    }, 30000);

    return () => {
      clearInterval(listInterval);
      if (retryAllRef.current) {
        clearInterval(retryAllRef.current);
        retryAllRef.current = null;
      }
    };
  }, [tasks, fetchTasks]);

  // Retry single task
  const handleRetry = async (task: Task) => {
    setRetryingId(task.id);
    try {
      const res = await fetch("/api/tasks/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, type: task.type }),
      });
      const data = await res.json();
      if (data.error) {
        alert(`Błąd: ${data.error}`);
      }
      fetchTasks();
    } catch {
      alert("Błąd połączenia");
    } finally {
      setRetryingId(null);
    }
  };

  // Retry all pending
  const handleRetryAll = async () => {
    setRetryAllLoading(true);
    try {
      const res = await fetch("/api/tasks/retry-all", { method: "POST" });
      const data = await res.json();
      if (data.results) {
        const r = data.results;
        alert(`Ukończone: ${r.completed}, Nadal pending: ${r.pending}, Błędy: ${r.failed}`);
      }
      fetchTasks();
    } catch {
      alert("Błąd połączenia");
    } finally {
      setRetryAllLoading(false);
    }
  };

  // Sort & filter
  const filtered = tasks
    .filter((t) => {
      if (search) {
        const q = search.toLowerCase();
        const matchName = t.businessName?.toLowerCase().includes(q);
        const matchKeyword = t.keyword?.toLowerCase().includes(q);
        if (!matchName && !matchKeyword) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "createdAt") cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortKey === "cost") cmp = (a.cost || 0) - (b.cost || 0);
      else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
      else if (sortKey === "type") cmp = a.type.localeCompare(b.type);
      return sortAsc ? cmp : -cmp;
    });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const pendingCount = tasks.filter((t) => t.status === "pending" || t.status === "ready").length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Tasks</h1>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <button
              onClick={handleRetryAll}
              disabled={retryAllLoading}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {retryAllLoading ? "Sprawdzam..." : `Sprawdź pending (${pendingCount})`}
            </button>
          )}
          <span className="text-xs text-gray-400">Tasks Dashboard</span>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <Card label="Wszystkie" value={summary.total} color="gray" />
          <Card label="W toku" value={summary.pending} color="yellow" />
          <Card label="Ukończone" value={summary.completed} color="green" />
          <Card label="Błędy" value={summary.failed} color="red" />
          <Card label="Łączny koszt" value={`$${summary.totalCost.toFixed(4)}`} color="purple" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">Wszystkie statusy</option>
          <option value="pending">Pending</option>
          <option value="ready">Ready</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">Wszystkie typy</option>
          <option value="review">Review</option>
          <option value="info">Info</option>
          <option value="search">Search</option>
        </select>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Szukaj po nazwie firmy..."
          className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-400 text-sm">Ładowanie...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-sm">Brak zadań do wyświetlenia.</p>
      ) : (
        <div className="overflow-x-auto border rounded-xl">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">DB ID</th>
                <th className="px-4 py-3 font-medium">DFS Task ID</th>
                <SortHeader label="Typ" sortKey="type" current={sortKey} asc={sortAsc} onClick={handleSort} />
                <th className="px-4 py-3 font-medium">Firma / Keyword</th>
                <SortHeader label="Status" sortKey="status" current={sortKey} asc={sortAsc} onClick={handleSort} />
                <th className="px-4 py-3 font-medium">Lokalizacja</th>
                <th className="px-4 py-3 font-medium">Użytkownik</th>
                <SortHeader label="Data" sortKey="createdAt" current={sortKey} asc={sortAsc} onClick={handleSort} />
                <SortHeader label="Koszt" sortKey="cost" current={sortKey} asc={sortAsc} onClick={handleSort} />
                <th className="px-4 py-3 font-medium">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((t) => (
                <tr key={`${t.type}-${t.id}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 text-xs font-mono" title={t.id}>
                    {shortId(t.id)}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs font-mono" title={t.dfsTaskId || ""}>
                    {shortId(t.dfsTaskId)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_STYLES[t.type]}`}>
                      {TYPE_LABELS[t.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-[250px] truncate">
                    {t.businessName || t.keyword || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[t.status] || "bg-gray-100 text-gray-600"}`}>
                      {t.status}
                    </span>
                    {t.error && (
                      <span className="block text-xs text-red-400 mt-0.5 truncate max-w-[200px]" title={t.error}>
                        {t.error}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {t.locationName || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[180px]" title={t.dfsLogin || ""}>
                    {t.dfsLogin || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap" title={new Date(t.createdAt).toLocaleString()}>
                    {timeAgo(t.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {t.cost != null ? `$${t.cost.toFixed(4)}` : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {(t.status === "pending" || t.status === "ready") && (
                        <button
                          onClick={() => handleRetry(t)}
                          disabled={retryingId === t.id}
                          className="px-2 py-1 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {retryingId === t.id ? "..." : "Wymuś"}
                        </button>
                      )}
                      {t.businessCid && (
                        <Link
                          href={`/business/${t.businessCid}`}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          Pokaż
                        </Link>
                      )}
                    </div>
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

function Card({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    gray: "bg-gray-50 border-gray-200",
    yellow: "bg-yellow-50 border-yellow-200",
    green: "bg-green-50 border-green-200",
    red: "bg-red-50 border-red-200",
    purple: "bg-purple-50 border-purple-200",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.gray}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-800">{value}</p>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  current,
  asc,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  asc: boolean;
  onClick: (key: SortKey) => void;
}) {
  return (
    <th
      className="px-4 py-3 font-medium cursor-pointer select-none hover:text-gray-700"
      onClick={() => onClick(sortKey)}
    >
      {label} {current === sortKey ? (asc ? "↑" : "↓") : ""}
    </th>
  );
}
