"use client";

import { useState, useRef, useCallback } from "react";
import { SearchResult } from "@/components/SearchResults";
import { useTaskStream } from "./useTaskStream";

interface UseSearchPollingOptions {
  onResults: (results: SearchResult[], fromCache: boolean, taskId: string) => void;
  onError: (error: string) => void;
}

export function useSearchPolling({ onResults, onError }: UseSearchPollingOptions) {
  const [loading, setLoading] = useState(false);
  const [taskStatus, setTaskStatus] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeTaskIdRef = useRef<string | null>(null);
  const [sseTaskIds, setSseTaskIds] = useState<string[]>([]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    activeTaskIdRef.current = null;
    setSseTaskIds([]);
  }, []);

  // Fetch results from status endpoint (shared by polling and SSE)
  const fetchResults = useCallback(async (taskId: string) => {
    try {
      const res = await fetch("/api/search/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();

      if (data.taskStatus === "completed") {
        stopPolling();
        onResults(data.results || [], false, taskId);
        setTaskStatus("completed");
        setLoading(false);
      } else if (data.taskStatus === "failed") {
        stopPolling();
        onError("Task wyszukiwania zakończony błędem");
        setTaskStatus("failed");
        setLoading(false);
      }
    } catch {
      stopPolling();
      onError("Błąd sprawdzania statusu wyszukiwania");
      setLoading(false);
    }
  }, [stopPolling, onResults, onError]);

  // SSE: instant notification when postback completes
  useTaskStream(sseTaskIds, (event) => {
    if (event.taskId === activeTaskIdRef.current) {
      if (event.status === "completed") {
        fetchResults(event.taskId);
      } else if (event.status === "failed") {
        stopPolling();
        onError("Task wyszukiwania zakończony błędem");
        setTaskStatus("failed");
        setLoading(false);
      }
    }
  });

  const pollSearchStatus = useCallback((taskId: string) => {
    stopPolling();
    setTaskStatus("pending");
    activeTaskIdRef.current = taskId;
    setSseTaskIds([taskId]);

    // Polling as fallback (15s interval)
    pollingRef.current = setInterval(() => fetchResults(taskId), 15000);
  }, [stopPolling, fetchResults]);

  const search = useCallback(async (params: {
    keyword: string;
    locationCode: number;
    locationName: string;
    languageCode: string;
    depth: number;
    method: string;
    refresh?: boolean;
  }) => {
    setLoading(true);
    setTaskStatus(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();

      if (!res.ok) {
        onError(data.error);
        setLoading(false);
        return;
      }

      if (data.taskStatus === "completed") {
        onResults(data.results || [], data.fromCache ?? false, data.taskId);
        setTaskStatus("completed");
        setLoading(false);
      } else if (data.taskStatus === "pending") {
        pollSearchStatus(data.taskId);
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Wystąpił błąd");
      setLoading(false);
    }
  }, [onResults, onError, pollSearchStatus]);

  return {
    loading,
    taskStatus,
    search,
    stopPolling,
  };
}
