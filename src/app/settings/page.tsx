"use client";

import { useState, useEffect } from "react";

export default function SettingsPage() {
  const [totalCost, setTotalCost] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    fetch("/api/costs")
      .then((r) => r.json())
      .then((data) => setTotalCost(data.totalCost ?? 0))
      .catch(() => {});
    const stored = localStorage.getItem("webhook_url");
    if (stored) setWebhookUrl(stored);
  }, []);

  const handleRefreshLocations = async () => {
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      const res = await fetch("/api/locations/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Błąd odświeżania");
      }
      setRefreshMsg({ type: "success", text: "Lokalizacje odświeżone pomyślnie." });
    } catch (e) {
      setRefreshMsg({ type: "error", text: e instanceof Error ? e.message : "Wystąpił błąd" });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Ustawienia</h1>

      {/* Webhook URL */}
      <div className="bg-white rounded-lg border p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Webhook URL</h2>
        <input
          type="url"
          value={webhookUrl}
          onChange={(e) => {
            setWebhookUrl(e.target.value);
            localStorage.setItem("webhook_url", e.target.value);
          }}
          className="w-full border rounded px-3 py-1.5 text-sm"
          placeholder="https://example.com/webhook"
        />
        <p className="text-xs text-gray-400 mt-1">URL używany domyślnie przy wysyłaniu wyników przez webhook</p>
      </div>

      <div className="bg-white rounded-lg border p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Lokalizacje i języki</h2>
        <p className="text-sm text-gray-600 mb-3">
          Dane lokalizacji są cache&apos;owane. Odśwież, jeśli DataForSEO zaktualizowało listę.
        </p>
        <button
          onClick={handleRefreshLocations}
          disabled={refreshing}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {refreshing ? "Odświeżanie..." : "Odśwież lokalizacje"}
        </button>
        {refreshMsg && (
          <p className={`text-sm mt-2 ${refreshMsg.type === "success" ? "text-green-600" : "text-red-600"}`}>
            {refreshMsg.text}
          </p>
        )}
      </div>

      {totalCost !== null && (
        <div className="bg-white rounded-lg border p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Koszty</h2>
          <p className="text-sm text-gray-600">
            Łączny koszt API: <span className="font-semibold">${totalCost.toFixed(4)}</span>
          </p>
        </div>
      )}
    </div>
  );
}
