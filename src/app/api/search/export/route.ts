import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateSearchCsv, generateSearchXlsx, SearchExportRow } from "@/lib/export";
import { getSessionCredentials, canAccess } from "@/lib/session";

export async function GET(req: NextRequest) {
  const credentials = await getSessionCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const taskId = req.nextUrl.searchParams.get("taskId");
  const format = req.nextUrl.searchParams.get("format") || "csv";

  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  // Verify task ownership before fetching results
  const task = await prisma.mapsSearchTask.findUnique({ where: { id: taskId } });
  if (!task) {
    return NextResponse.json({ error: "No results found for this task" }, { status: 404 });
  }
  if (!canAccess(task, credentials.login)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results = await prisma.mapsSearchResult.findMany({
    where: { taskId },
    orderBy: { rankAbsolute: "asc" },
  });

  if (results.length === 0) {
    return NextResponse.json({ error: "No results found for this task" }, { status: 404 });
  }

  const rows: SearchExportRow[] = results.map((r) => ({
    title: r.title,
    address: r.address || "",
    phone: r.phone || "",
    domain: r.domain || "",
    cid: r.cid || "",
    rating: r.rating != null ? r.rating.toString() : "",
    votesCount: r.votesCount != null ? r.votesCount.toString() : "",
    category: r.category || "",
  }));

  if (format === "xlsx") {
    const buffer = generateSearchXlsx(rows);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="search-results-${taskId}.xlsx"`,
      },
    });
  }

  // Default: CSV
  const csv = generateSearchCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="search-results-${taskId}.csv"`,
    },
  });
}
