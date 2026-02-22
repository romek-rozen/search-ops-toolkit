import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionCredentials, canAccess } from "@/lib/session";

// GET /api/search/results?taskId=XXX — fetch search results by task ID
export async function GET(req: NextRequest) {
  const credentials = await getSessionCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const taskId = req.nextUrl.searchParams.get("taskId");

  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const task = await prisma.mapsSearchTask.findUnique({
    where: { id: taskId },
    include: { results: { orderBy: { rankAbsolute: "asc" } } },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Verify ownership — owner, admin, or shared task
  if (!canAccess(task, credentials.login)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    results: task.results,
    keyword: task.keyword,
    locationName: task.locationName,
    locationCode: task.locationCode,
    languageCode: task.languageCode,
    depth: task.depth,
    method: task.method,
    taskStatus: task.status,
  });
}
