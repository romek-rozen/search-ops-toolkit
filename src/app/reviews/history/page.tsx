"use client";

import BusinessesList from "@/components/BusinessesList";
import { useRouter } from "next/navigation";

export default function HistoryPage() {
  const router = useRouter();

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Historia opinii</h1>
      <BusinessesList onSelectBusiness={(cid) => router.push(`/reviews?cid=${cid}`)} />
    </div>
  );
}
