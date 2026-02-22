"use client";

import { useEffect, useRef } from "react";

export interface TaskCompleteEvent {
  taskId: string;
  dfsTaskId: string;
  tag: "reviews" | "search" | "business-info";
  status: "completed" | "failed";
  error?: string;
}

// SSE subscription hook for real-time task completion notifications.
// Falls back gracefully — if SSE fails, polling continues as before.
export function useTaskStream(
  taskIds: string[],
  onComplete: (event: TaskCompleteEvent) => void
) {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const key = taskIds.filter(Boolean).sort().join(",");

  useEffect(() => {
    if (!key) return;

    const url = `/api/tasks/stream?taskIds=${key}`;
    const es = new EventSource(url);

    es.onmessage = (e) => {
      try {
        const event: TaskCompleteEvent = JSON.parse(e.data);
        onCompleteRef.current(event);
      } catch {
        // Ignore malformed messages
      }
    };

    es.onerror = () => {
      // Close on error — polling fallback will handle it
      es.close();
    };

    return () => es.close();
  }, [key]);
}
