"use client";

interface Props {
  reviewTasksCost: number;
  infoTasksCost: number;
  totalCost: number;
}

export default function CostsSummary({ reviewTasksCost, infoTasksCost, totalCost }: Props) {
  return (
    <div className="card mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
        Koszty API
      </h2>
      <div className="flex gap-8 text-sm">
        <div>
          <div className="text-xs text-slate-400 mb-0.5">Pobieranie recenzji</div>
          <div className="font-medium text-slate-700">
            {reviewTasksCost > 0 ? `$${reviewTasksCost.toFixed(4)}` : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400 mb-0.5">Informacje o firmie</div>
          <div className="font-medium text-slate-700">
            {infoTasksCost > 0 ? `$${infoTasksCost.toFixed(4)}` : "—"}
          </div>
        </div>
        <div className="ml-auto pl-8 border-l border-slate-100">
          <div className="text-xs text-slate-400 mb-0.5">Razem</div>
          <div className="font-bold text-slate-900 text-base">
            {totalCost > 0 ? `$${totalCost.toFixed(4)}` : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
