"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReviewExportBar from "@/components/ReviewExportBar";
import ShareButton from "@/components/ShareButton";

interface ReviewData {
  id: string;
  authorName: string;
  authorAvatar?: string | null;
  rating: number;
  text?: string | null;
  publishedAt?: string | null;
  ownerResponse?: string | null;
  ownerRespondedAt?: string | null;
}

interface TaskInfo {
  id: string;
  status: string;
  depth: number;
  locationName?: string | null;
  languageName?: string | null;
  isShared?: boolean;
  dfsLogin?: string | null;
  createdAt: string;
  business?: {
    cid: string;
    name: string;
  } | null;
}

const stars = (rating: number) => "★".repeat(rating) + "☆".repeat(5 - rating);

export default function ReviewTaskPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [taskInfo, setTaskInfo] = useState<TaskInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentLogin, setCurrentLogin] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/reviews/by-task/${taskId}`);
        if (!res.ok) throw new Error("Nie znaleziono taska");
        const data = await res.json();
        setReviews(data.reviews || []);
        if (data.task) setTaskInfo(data.task);
      } catch {
        setError("Nie udało się pobrać opinii");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setCurrentLogin(d.login || null))
      .catch(() => {});
  }, [taskId]);

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto p-6">
        <p className="text-gray-500">Ładowanie opinii...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-6xl mx-auto p-6">
        <p className="text-red-500">{error}</p>
      </main>
    );
  }

  const businessName = taskInfo?.business?.name;
  const businessCid = taskInfo?.business?.cid;

  return (
    <main className="max-w-6xl mx-auto p-6">
      {/* Navigation */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        {businessCid ? (
          <Link href={`/business/${businessCid}`} className="text-blue-600 hover:text-blue-800">
            ← {businessName || "Firma"}
          </Link>
        ) : (
          <Link href="/reviews/history" className="text-blue-600 hover:text-blue-800">
            ← Historia
          </Link>
        )}
      </div>

      {/* Header */}
      <div className="bg-white rounded-lg border p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-semibold">
            {businessName ? `Opinie — ${businessName}` : "Opinie"}
          </h1>
          {taskInfo && (
            <ShareButton
              taskId={taskInfo.id}
              taskType="review"
              isShared={taskInfo.isShared ?? false}
              isOwner={currentLogin === taskInfo.dfsLogin}
            />
          )}
        </div>
        <div className="flex gap-6 text-sm text-gray-500">
          <span>Liczba opinii: <strong className="text-gray-700">{reviews.length}</strong></span>
          {taskInfo?.locationName && <span>Lokalizacja: {taskInfo.locationName}</span>}
          {taskInfo?.languageName && <span>Język: {taskInfo.languageName}</span>}
          {taskInfo?.depth && <span>Depth: {taskInfo.depth}</span>}
          {taskInfo?.createdAt && (
            <span>Data: {new Date(taskInfo.createdAt).toLocaleString("pl-PL")}</span>
          )}
        </div>
      </div>

      {/* Export bar */}
      <ReviewExportBar reviews={reviews} taskId={taskId} businessName={businessName || undefined} />

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <p className="text-sm text-gray-400">Brak opinii dla tego taska.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="bg-white rounded-lg border p-4 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{r.authorName}</span>
                <span className="text-yellow-500 text-xs">{stars(r.rating)}</span>
                {r.publishedAt && (
                  <span className="text-gray-400 text-xs">
                    {new Date(r.publishedAt).toLocaleDateString("pl-PL")}
                  </span>
                )}
              </div>
              {r.text && <p className="text-gray-700">{r.text}</p>}
              {r.ownerResponse && (
                <div className="mt-2 pl-3 border-l-2 border-blue-200">
                  <p className="text-xs text-gray-500">Odpowiedź właściciela:</p>
                  <p className="text-sm text-gray-600">{r.ownerResponse}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
