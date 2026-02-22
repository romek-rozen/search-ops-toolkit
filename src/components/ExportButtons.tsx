"use client";

interface Props {
  cid: string;
  disabled?: boolean;
}

export default function ExportButtons({ cid, disabled }: Props) {
  const handleExport = (format: "csv" | "xlsx") => {
    window.open(`/api/export?cid=${encodeURIComponent(cid)}&format=${format}`, "_blank");
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleExport("csv")}
        disabled={disabled}
        className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50 disabled:opacity-50"
      >
        Eksport CSV
      </button>
      <button
        onClick={() => handleExport("xlsx")}
        disabled={disabled}
        className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50 disabled:opacity-50"
      >
        Eksport Excel
      </button>
    </div>
  );
}
