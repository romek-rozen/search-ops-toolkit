import * as XLSX from "xlsx";

// --- Search results export ---

export interface SearchExportRow {
  title: string;
  address: string;
  phone: string;
  domain: string;
  cid: string;
  rating: string;
  votesCount: string;
  category: string;
}

export function generateSearchCsv(rows: SearchExportRow[]): string {
  const headers = ["Nazwa", "Adres", "Telefon", "Domena", "CID", "Ocena", "Liczba opinii", "Kategoria"];
  const escape = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        escape(r.title),
        escape(r.address),
        escape(r.phone),
        escape(r.domain),
        escape(r.cid),
        escape(r.rating),
        escape(r.votesCount),
        escape(r.category),
      ].join(",")
    ),
  ];

  return "\uFEFF" + lines.join("\n"); // BOM for Excel UTF-8
}

export function generateSearchXlsx(rows: SearchExportRow[]): ArrayBuffer {
  const data = rows.map((r) => ({
    Nazwa: r.title,
    Adres: r.address,
    Telefon: r.phone,
    Domena: r.domain,
    CID: r.cid,
    Ocena: r.rating,
    "Liczba opinii": r.votesCount,
    Kategoria: r.category,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Auto-width columns
  const colWidths = Object.keys(data[0] || {}).map((key) => ({
    wch: Math.max(
      key.length,
      ...data.map((row) => String(row[key as keyof typeof row] ?? "").length)
    ),
  }));
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, "Wyniki wyszukiwania");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as number[];
  return new Uint8Array(out).buffer as ArrayBuffer;
}

// --- Reviews export ---

interface ReviewExportRow {
  author: string;
  rating: number;
  date: string;
  text: string;
  ownerResponse: string;
}

export function generateCsv(rows: ReviewExportRow[]): string {
  const headers = ["Autor", "Ocena", "Data", "Treść opinii", "Odpowiedź właściciela"];
  const escape = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        escape(r.author),
        r.rating.toString(),
        escape(r.date),
        escape(r.text),
        escape(r.ownerResponse),
      ].join(",")
    ),
  ];

  return "\uFEFF" + lines.join("\n"); // BOM for Excel UTF-8
}

export function generateXlsx(rows: ReviewExportRow[]): ArrayBuffer {
  const data = rows.map((r) => ({
    Autor: r.author,
    Ocena: r.rating,
    Data: r.date,
    "Treść opinii": r.text,
    "Odpowiedź właściciela": r.ownerResponse,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Auto-width kolumn
  const colWidths = Object.keys(data[0] || {}).map((key) => ({
    wch: Math.max(
      key.length,
      ...data.map((row) => String(row[key as keyof typeof row] ?? "").length)
    ),
  }));
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, "Opinie");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as number[];
  return new Uint8Array(out).buffer as ArrayBuffer;
}
