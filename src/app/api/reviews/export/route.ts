import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateCsv, generateXlsx } from "@/lib/export";
import { getSessionCredentials, canAccess } from "@/lib/session";

export async function GET(req: NextRequest) {
  const credentials = await getSessionCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const taskId = searchParams.get("taskId");
  const format = searchParams.get("format") || "csv";

  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const task = await prisma.reviewTask.findUnique({
    where: { id: taskId },
    include: {
      business: { select: { name: true } },
      reviews: { orderBy: { publishedAt: "desc" } },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Verify ownership — owner, admin, or shared task
  if (!canAccess(task, credentials.login)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = task.reviews.map((r) => ({
    author: r.authorName,
    rating: r.rating,
    date: r.publishedAt ? new Date(r.publishedAt).toISOString().slice(0, 10) : "",
    text: r.text || "",
    ownerResponse: r.ownerResponse || "",
  }));

  const safeName = (task.business?.name || "opinie").replace(/[^a-zA-Z0-9_-]/g, "_");

  if (format === "xlsx") {
    const buffer = generateXlsx(rows);
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeName}.xlsx"`,
      },
    });
  }

  // CSV
  const csv = generateCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}.csv"`,
    },
  });
}
