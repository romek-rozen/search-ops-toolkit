"use client";

import { useState } from "react";
import { SearchResult } from "./SearchResults";
import { generateSearchCsv, generateSearchXlsx, SearchExportRow } from "@/lib/export";

interface Props {
  results: SearchResult[];
  taskId?: string | null;
}

function toExportRows(results: SearchResult[]): SearchExportRow[] {
  return results.map((r) => ({
    title: r.title,
    address: r.address || "",
    phone: r.phone || "",
    domain: r.domain || "",
    cid: r.cid || "",
    rating: r.rating != null ? r.rating.toString() : "",
    votesCount: r.votesCount != null ? r.votesCount.toString() : "",
    category: r.category || "",
  }));
}

export default function SearchExportBar({ results, taskId }: Props) {
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);

  const handleCsv = () => {
    if (taskId) {
      window.open(`/api/search/export?taskId=${taskId}&format=csv`, "_blank");
    } else {
      // Client-side generation for live results without taskId
      const csv = generateSearchCsv(toExportRows(results));
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "search-results.csv";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleXlsx = () => {
    if (taskId) {
      window.open(`/api/search/export?taskId=${taskId}&format=xlsx`, "_blank");
    } else {
      const buffer = generateSearchXlsx(toExportRows(results));
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "search-results.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const openWebhookModal = () => {
    const saved = localStorage.getItem("webhook_url") || "";
    setWebhookUrl(saved);
    setWebhookStatus(null);
    setWebhookOpen(true);
  };

  const sendWebhook = async () => {
    if (!webhookUrl.trim()) return;
    setWebhookLoading(true);
    setWebhookStatus(null);

    try {
      const body: Record<string, unknown> = { webhookUrl: webhookUrl.trim() };
      if (taskId) {
        body.taskId = taskId;
      } else {
        body.results = results.map((r) => ({
          title: r.title,
          address: r.address,
          phone: r.phone,
          domain: r.domain,
          cid: r.cid,
          rating: r.rating,
          votesCount: r.votesCount,
          category: r.category,
        }));
      }

      const res = await fetch("/api/search/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        setWebhookStatus(`Wysłano (${data.status} ${data.statusText})`);
      } else {
        setWebhookStatus(`Błąd: ${data.error || data.status + " " + data.statusText}`);
      }
    } catch (err) {
      setWebhookStatus(`Błąd: ${err instanceof Error ? err.message : "Nieznany błąd"}`);
    } finally {
      setWebhookLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-slate-500">Eksport:</span>
        <button
          onClick={handleCsv}
          className="btn-sm"
        >
          CSV
        </button>
        <button
          onClick={handleXlsx}
          className="btn-sm"
        >
          XLSX
        </button>
        <button
          onClick={openWebhookModal}
          className="btn-sm"
        >
          Webhook
        </button>
      </div>

      {/* Webhook modal */}
      {webhookOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl ring-1 ring-black/5 p-6 w-full max-w-md">
            <h3 className="text-sm font-semibold mb-3">Wyślij wyniki na webhook</h3>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => {
                setWebhookUrl(e.target.value);
                localStorage.setItem("webhook_url", e.target.value);
              }}
              placeholder="https://example.com/webhook"
              className="form-input w-full mb-3"
            />
            {webhookStatus && (
              <div className={`text-xs mb-3 ${webhookStatus.startsWith("Wysłano") ? "text-green-600" : "text-red-600"}`}>
                {webhookStatus}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setWebhookOpen(false)}
                className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5"
              >
                Zamknij
              </button>
              <button
                onClick={sendWebhook}
                disabled={webhookLoading || !webhookUrl.trim()}
                className="btn-primary text-sm py-1.5 px-4"
              >
                {webhookLoading ? "Wysyłam..." : "Wyślij"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
