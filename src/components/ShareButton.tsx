"use client";

import { useState } from "react";

interface ShareButtonProps {
  taskId: string;
  taskType: "review" | "mapsSearch";
  isShared: boolean;
  isOwner: boolean;
  onChange?: (isShared: boolean) => void;
}

export default function ShareButton({ taskId, taskType, isShared: initialShared, isOwner, onChange }: ShareButtonProps) {
  const [shared, setShared] = useState(initialShared);
  const [loading, setLoading] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOwner) return;
    setLoading(true);
    try {
      const res = await fetch("/api/share", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, taskType, isShared: !shared }),
      });
      if (res.ok) {
        setShared(!shared);
        onChange?.(!shared);
      }
    } finally {
      setLoading(false);
    }
  };

  // Non-owners see a read-only badge
  if (!isOwner) {
    if (!shared) return null;
    return (
      <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full" title="Udostepnione">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
        Udostepnione
      </span>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors disabled:opacity-50 ${
        shared
          ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      }`}
      title={shared ? "Kliknij aby cofnac udostepnienie" : "Kliknij aby udostepnic"}
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
      </svg>
      {loading ? "..." : shared ? "Udostepnione" : "Udostepnij"}
    </button>
  );
}
