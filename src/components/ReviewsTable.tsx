"use client";

interface Review {
  id: string;
  authorName: string;
  rating: number;
  text?: string | null;
  publishedAt?: string | null;
  ownerResponse?: string | null;
}

interface Props {
  reviews: Review[];
  total: number;
  offset: number;
  limit: number;
  onPageChange: (offset: number) => void;
}

export default function ReviewsTable({ reviews, total, offset, limit, onPageChange }: Props) {
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div>
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Autor</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600 w-20">Ocena</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600 w-28">Data</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Treść</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Odpowiedź</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((r) => (
              <tr key={r.id} className="border-b last:border-b-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{r.authorName}</td>
                <td className="px-4 py-3">
                  <span className="text-yellow-500">
                    {"★".repeat(r.rating)}
                    {"☆".repeat(5 - r.rating)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {r.publishedAt
                    ? new Date(r.publishedAt).toLocaleDateString("pl-PL")
                    : "—"}
                </td>
                <td className="px-4 py-3 max-w-xs">
                  <p className="line-clamp-3">{r.text || "—"}</p>
                </td>
                <td className="px-4 py-3 max-w-xs text-gray-500">
                  <p className="line-clamp-2">{r.ownerResponse || "—"}</p>
                </td>
              </tr>
            ))}
            {reviews.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Brak opinii
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <span className="text-sm text-gray-500">
            Strona {currentPage} z {totalPages} ({total} opinii)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(offset - limit)}
              disabled={offset === 0}
              className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Poprzednia
            </button>
            <button
              onClick={() => onPageChange(offset + limit)}
              disabled={offset + limit >= total}
              className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Następna
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
