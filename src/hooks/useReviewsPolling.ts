"use client";

import { useState, useRef, useCallback } from "react";
import { useTaskStream } from "./useTaskStream";

interface Review {
  id: string;
  authorName: string;
  rating: number;
  text?: string | null;
  publishedAt?: string | null;
  ownerResponse?: string | null;
}

interface UseReviewsPollingOptions {
  limit: number;
  onCompleted: (reviews: Review[], total: number) => void;
  onError: (error: string) => void;
  onCostUpdate?: () => void;
}

export function useReviewsPolling({ limit, onCompleted, onError, onCostUpdate }: UseReviewsPollingOptions) {
  const [taskStatus, setTaskStatus] = useState<string | null>(null);
  const [taskDepth, setTaskDepth] = useState<number | null>(null);
  const [taskCreatedAt, setTaskCreatedAt] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeTaskIdRef = useRef<string | null>(null);
  const [sseTaskIds, setSseTaskIds] = useState<string[]>([]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    activeTaskIdRef.current = null;
    setSseTaskIds([]);
  }, []);

  const startTick = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    setNow(Date.now());
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
  }, []);

  // Fetch status from API (shared by polling and SSE)
  const fetchStatus = useCallback(async (taskId: string) => {
    try {
      const res = await fetch("/api/reviews/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, offset: 0, limit }),
      });
      const data = await res.json();

      if (data.taskStatus === "completed") {
        stopPolling();
        onCompleted(data.reviews || [], data.total || 0);
        setTaskStatus("completed");
        onCostUpdate?.();
      } else if (data.taskStatus === "failed") {
        stopPolling();
        onError(data.error || "Task zakończony błędem");
        setTaskStatus("failed");
      }
    } catch {
      stopPolling();
      onError("Błąd podczas sprawdzania statusu taska");
    }
  }, [limit, stopPolling, onCompleted, onError, onCostUpdate]);

  // SSE: instant notification when postback completes
  useTaskStream(sseTaskIds, (event) => {
    if (event.taskId === activeTaskIdRef.current) {
      if (event.status === "completed") {
        fetchStatus(event.taskId);
      } else if (event.status === "failed") {
        stopPolling();
        onError(event.error || "Task zakończony błędem");
        setTaskStatus("failed");
      }
    }
  });

  const pollTaskStatus = useCallback((taskId: string) => {
    stopPolling();
    setTaskStatus("pending");
    startTick();
    activeTaskIdRef.current = taskId;
    setSseTaskIds([taskId]);

    // Polling as fallback (15s interval)
    pollingRef.current = setInterval(() => fetchStatus(taskId), 15000);
  }, [stopPolling, startTick, fetchStatus]);

  return {
    taskStatus,
    setTaskStatus,
    taskDepth,
    setTaskDepth,
    taskCreatedAt,
    setTaskCreatedAt,
    now,
    pollTaskStatus,
    stopPolling,
  };
}
