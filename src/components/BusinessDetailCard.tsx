interface Props {
  business: {
    cid: string;
    name: string;
    address?: string | null;
    city?: string | null;
    country?: string | null;
    phone?: string | null;
    website?: string | null;
    category?: string | null;
    rating?: number | null;
    totalReviews?: number | null;
    mapsUrl?: string | null;
    updatedAt: string;
    _count: { reviews: number };
  };
  additionalCategories?: string[];
}

export default function BusinessDetailCard({ business, additionalCategories }: Props) {
  const isUnknown = business.name === "Nieznana firma";

  return (
    <div className="bg-white rounded-lg border p-6 mb-6">
      <div className="flex justify-between items-start">
        <div>
          {(business.category || (additionalCategories && additionalCategories.length > 0)) && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {business.category && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                  {business.category}
                </span>
              )}
              {additionalCategories?.map((cat) => (
                <span key={cat} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  {cat}
                </span>
              ))}
            </div>
          )}
          <h1 className="text-2xl font-bold">
            {isUnknown ? `CID: ${business.cid}` : business.name}
          </h1>
          <span className="text-xs text-gray-300 font-mono">CID: {business.cid}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-6 text-sm text-gray-600">
        {business.rating != null && (
          <div>
            <span className="font-semibold text-yellow-600">
              {"★".repeat(Math.round(business.rating))}
            </span>{" "}
            {business.rating.toFixed(1)}
            {business.totalReviews != null && (
              <span className="text-gray-400"> ({business.totalReviews} opinii Google)</span>
            )}
          </div>
        )}
        <div className="text-gray-500">
          {business._count.reviews} opinii w bazie
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-6 text-sm text-gray-500">
        {business.address && <div>{business.address}</div>}
        {(business.city || business.country) && (
          <div>{[business.city, business.country].filter(Boolean).join(", ")}</div>
        )}
        {business.phone && <div>{business.phone}</div>}
        {business.website && (
          <a
            href={business.website.startsWith("http") ? business.website : `https://${business.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            {business.website}
          </a>
        )}
        {business.mapsUrl && (
          <a
            href={business.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            Google Maps
          </a>
        )}
      </div>

      <div className="mt-3 text-xs text-gray-300">
        Ostatnia aktualizacja: {new Date(business.updatedAt).toLocaleString("pl-PL")}
      </div>
    </div>
  );
}
