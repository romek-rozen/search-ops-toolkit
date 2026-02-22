"use client";

import { useState, useRef, useCallback } from "react";

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

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const startTick = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    setNow(Date.now());
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
  }, []);

  const pollTaskStatus = useCallback((taskId: string) => {
    stopPolling();
    setTaskStatus("pending");
    startTick();

    pollingRef.current = setInterval(async () => {
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
    }, 30000);
  }, [limit, stopPolling, startTick, onCompleted, onError, onCostUpdate]);

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
