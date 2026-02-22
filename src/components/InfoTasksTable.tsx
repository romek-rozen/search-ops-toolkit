"use client";

interface InfoTask {
  id: string;
  status: string;
  cost: number | null;
  timeSec: string | null;
  locationName: string | null;
  languageCode: string | null;
  error: string | null;
  createdAt: string;
}

const statusLabel = (status: string) => {
  const map: Record<string, { text: string; cls: string }> = {
    pending: { text: "Oczekuje", cls: "badge-yellow" },
    ready: { text: "Gotowy", cls: "badge-blue" },
    completed: { text: "Ukończony", cls: "badge-green" },
    failed: { text: "Błąd", cls: "badge-red" },
  };
  const s = map[status] || { text: status, cls: "badge-gray" };
  return <span className={`badge ${s.cls}`}>{s.text}</span>;
};

interface Props {
  tasks: InfoTask[];
}

export default function InfoTasksTable({ tasks }: Props) {
  if (tasks.length === 0) {
    return <p className="text-sm text-gray-400">Brak tasków.</p>;
  }

  return (
    <div className="table-scroll-container">
      <table className="data-table min-w-[600px]">
        <thead>
          <tr>
            <th>Data</th>
            <th>Status</th>
            <th>Lokalizacja</th>
            <th>Język</th>
            <th>Czas</th>
            <th className="text-right">Koszt</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <td className="text-slate-500">
                {new Date(t.createdAt).toLocaleString("pl-PL")}
              </td>
              <td>{statusLabel(t.status)}</td>
              <td className="text-slate-500">{t.locationName || "—"}</td>
              <td className="text-slate-500">{t.languageCode || "—"}</td>
              <td className="text-slate-500">{t.timeSec ? `${t.timeSec}s` : "—"}</td>
              <td className="text-right text-slate-500">
                {t.cost != null && t.cost > 0 ? `$${t.cost.toFixed(4)}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
