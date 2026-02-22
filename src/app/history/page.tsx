"use client";

import Link from "next/link";
import BusinessesList from "@/components/BusinessesList";

export default function HistoryPage() {
  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Historia</h1>
        <Link href="/" className="text-sm text-blue-600 hover:text-blue-800">
          Powrót
        </Link>
      </div>

      <BusinessesList />
    </main>
  );
}
