"use client";

import { useState, useRef, useCallback } from "react";

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

  const stopBizPolling = useCallback(() => {
    if (bizPollingRef.current) {
      clearInterval(bizPollingRef.current);
      bizPollingRef.current = null;
    }
  }, []);

  const pollBusinessInfo = useCallback((dfsTaskId: string) => {
    stopBizPolling();
    setAsyncPending(true);
    bizPollingRef.current = setInterval(async () => {
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
    }, 30000);
  }, [stopBizPolling, onBusinessUpdate, onCostUpdate]);

  return {
    asyncPending,
    pollBusinessInfo,
    stopBizPolling,
  };
}
