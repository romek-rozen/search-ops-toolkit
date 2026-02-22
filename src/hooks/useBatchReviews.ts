"use client";

import { useState, useRef, useCallback } from "react";
import { SearchResult } from "@/components/SearchResults";

type BatchItemStatus = "idle" | "pending" | "completed" | "failed";

interface UseBatchReviewsOptions {
  selectedLanguage: string;
  getLocationName: () => string;
  depth: number;
  sortBy: string;
  onError: (error: string) => void;
}

export function useBatchReviews({ selectedLanguage, getLocationName, depth, sortBy, onError }: UseBatchReviewsOptions) {
  const [batchStatus, setBatchStatus] = useState<Record<string, BatchItemStatus>>({});
  const [batchLoading, setBatchLoading] = useState(false);
  const batchPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopBatchPolling = useCallback(() => {
    if (batchPollingRef.current) {
      clearInterval(batchPollingRef.current);
      batchPollingRef.current = null;
    }
  }, []);

  const pollBatchStatus = useCallback((taskIds: string[]) => {
    stopBatchPolling();

    batchPollingRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/reviews/batch/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskIds }),
        });
        const data = await res.json();

        if (data.statusMap) {
          const newStatus: Record<string, BatchItemStatus> = {};
          for (const [, info] of Object.entries(data.statusMap) as [string, { status: string; businessCid?: string }][]) {
            if (info.businessCid) {
              newStatus[info.businessCid] = info.status as BatchItemStatus;
            }
          }
          setBatchStatus((prev) => ({ ...prev, ...newStatus }));
        }

        if (data.pending === 0) {
          stopBatchPolling();
        }
      } catch {
        stopBatchPolling();
      }
    }, 30000);
  }, [stopBatchPolling]);

  const handleBatchFetchReviews = useCallback(async (items: SearchResult[]) => {
    if (items.length === 0) return;

    setBatchLoading(true);
    const newStatus: Record<string, BatchItemStatus> = {};
    items.forEach((item) => { if (item.cid) newStatus[item.cid] = "pending"; });
    setBatchStatus((prev) => ({ ...prev, ...newStatus }));

    try {
      const res = await fetch("/api/reviews/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            cid: item.cid,
            title: item.title,
            address: item.address,
            category: item.category,
            rating: item.rating,
            votesCount: item.votesCount,
          })),
          languageName: selectedLanguage,
          locationName: getLocationName(),
          depth,
          sortBy,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        onError(data.error);
        items.forEach((item) => { if (item.cid) newStatus[item.cid] = "failed"; });
        setBatchStatus((prev) => ({ ...prev, ...newStatus }));
        setBatchLoading(false);
        return;
      }

      setBatchLoading(false);
      pollBatchStatus(data.taskIds);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Wystąpił błąd");
      items.forEach((item) => { if (item.cid) newStatus[item.cid] = "failed"; });
      setBatchStatus((prev) => ({ ...prev, ...newStatus }));
      setBatchLoading(false);
    }
  }, [selectedLanguage, getLocationName, depth, sortBy, onError, pollBatchStatus]);

  return {
    batchStatus,
    batchLoading,
    handleBatchFetchReviews,
    stopBatchPolling,
  };
}
