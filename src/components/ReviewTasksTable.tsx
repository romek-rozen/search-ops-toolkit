"use client";

import React, { useState } from "react";
import Link from "next/link";
import ReviewExportBar from "./ReviewExportBar";

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

const statusLabel = (status: string) => {
  const map: Record<string, { text: string; cls: string }> = {
    pending: { text: "Oczekuje", cls: "badge-yellow" },
    ready: { text: "Gotowy", cls: "badge-blue" },
    completed: { text: "Ukończony", cls: "badge-green" },
    failed: { text: "Błąd", cls: "badge-red" },
  };
  const s = map[status] || { text: status, cls: "badge-gray" };
  return <span className={`badge ${s.cls}`}>{s.text}</span>;
};

interface Props {
  tasks: ReviewTask[];
  businessName: string;
}

export default function ReviewTasksTable({ tasks, businessName }: Props) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  if (tasks.length === 0) {
    return <p className="text-sm text-gray-400">Brak tasków.</p>;
  }

  return (
    <div className="table-scroll-container">
      <table className="data-table min-w-[700px]">
        <thead>
          <tr>
            <th>Data</th>
            <th>Status</th>
            <th>Depth</th>
            <th>Opinie</th>
            <th>Lokalizacja</th>
            <th>Język</th>
            <th>Czas</th>
            <th className="text-right">Koszt</th>
            <th className="w-8"></th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <React.Fragment key={t.id}>
              <tr
                className={t.status === "completed" ? "cursor-pointer" : ""}
                onClick={() => {
                  if (t.status === "completed") {
                    setExpandedTaskId(expandedTaskId === t.id ? null : t.id);
                  }
                }}
              >
                <td className="text-slate-500">
                  {new Date(t.createdAt).toLocaleString("pl-PL")}
                </td>
                <td>{statusLabel(t.status)}</td>
                <td>{t.depth}</td>
                <td className="text-slate-500">{t._count?.reviews ?? "—"}</td>
                <td className="text-slate-500">{t.locationName || "—"}</td>
                <td className="text-slate-500">{t.languageName || "—"}</td>
                <td className="text-slate-500">{t.timeSec ? `${t.timeSec}s` : "—"}</td>
                <td className="text-right text-slate-500">
                  {t.cost != null && t.cost > 0 ? `$${t.cost.toFixed(4)}` : "—"}
                </td>
                <td className="text-brand-500 text-xs">
                  {t.status === "completed" ? (
                    <span title="Pokaż opcje eksportu / otwórz recenzje">
                      {expandedTaskId === t.id ? "▼" : "→"}
                    </span>
                  ) : ""}
                </td>
              </tr>
              {expandedTaskId === t.id && t.status === "completed" && (
                <tr>
                  <td colSpan={9} className="!bg-slate-50 border-b">
                    <div className="flex items-center justify-between">
                      <ReviewExportBar taskId={t.id} businessName={businessName} />
                      <Link
                        href={`/reviews/task/${t.id}`}
                        className="text-xs text-blue-600 hover:text-blue-800 ml-4 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Otwórz recenzje →
                      </Link>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
