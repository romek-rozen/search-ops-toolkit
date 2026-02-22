"use client";

import { useState, useRef, useCallback } from "react";
import { useTaskStream } from "./useTaskStream";

interface Business {
  id: string;
  cid: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  category?: string | null;
  rating?: number | null;
  totalReviews?: number | null;
}

interface UseBusinessInfoPollingOptions {
  onBusinessUpdate: (business: Business) => void;
  onCostUpdate?: () => void;
}

export function useBusinessInfoPolling({ onBusinessUpdate, onCostUpdate }: UseBusinessInfoPollingOptions) {
  const [asyncPending, setAsyncPending] = useState(false);
  const bizPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeDfsTaskIdRef = useRef<string | null>(null);
  // Store DB task ID for SSE (we need to map dfsTaskId -> dbTaskId)
  const activeDbTaskIdRef = useRef<string | null>(null);
  const [sseTaskIds, setSseTaskIds] = useState<string[]>([]);

  const stopBizPolling = useCallback(() => {
    if (bizPollingRef.current) {
      clearInterval(bizPollingRef.current);
      bizPollingRef.current = null;
    }
    activeDfsTaskIdRef.current = null;
    activeDbTaskIdRef.current = null;
    setSseTaskIds([]);
  }, []);

  // Fetch status from API (shared by polling and SSE)
  const fetchBizStatus = useCallback(async (dfsTaskId: string) => {
    try {
      const res = await fetch("/api/business-info/task/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dfsTaskId }),
      });
      const data = await res.json();
      if (data.taskStatus === "completed" && data.business) {
        stopBizPolling();
        setAsyncPending(false);
        onBusinessUpdate(data.business);
        onCostUpdate?.();
      } else if (data.taskStatus === "failed") {
        stopBizPolling();
        setAsyncPending(false);
      }
    } catch {
      stopBizPolling();
      setAsyncPending(false);
    }
  }, [stopBizPolling, onBusinessUpdate, onCostUpdate]);

  // SSE: instant notification when postback completes
  useTaskStream(sseTaskIds, (event) => {
    if (event.tag === "business-info" && event.taskId === activeDbTaskIdRef.current) {
      if (activeDfsTaskIdRef.current) {
        fetchBizStatus(activeDfsTaskIdRef.current);
      }
    }
  });

  const pollBusinessInfo = useCallback((dfsTaskId: string, dbTaskId?: string) => {
    stopBizPolling();
    setAsyncPending(true);
    activeDfsTaskIdRef.current = dfsTaskId;
    activeDbTaskIdRef.current = dbTaskId || null;
    if (dbTaskId) {
      setSseTaskIds([dbTaskId]);
    }

    // Polling as fallback (15s interval)
    bizPollingRef.current = setInterval(() => fetchBizStatus(dfsTaskId), 15000);
  }, [stopBizPolling, fetchBizStatus]);

  return {
    asyncPending,
    pollBusinessInfo,
    stopBizPolling,
  };
}
