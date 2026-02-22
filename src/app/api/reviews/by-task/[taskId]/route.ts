import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionCredentials, canAccess } from "@/lib/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const credentials = await getSessionCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await params;

  const task = await prisma.reviewTask.findUnique({
    where: { id: taskId },
    include: {
      business: { select: { cid: true, name: true } },
      reviews: {
        orderBy: { publishedAt: "desc" },
      },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task nie znaleziony" }, { status: 404 });
  }

  // Verify ownership — owner, admin, or shared task
  if (!canAccess(task, credentials.login)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    reviews: task.reviews,
    total: task.reviews.length,
    task: {
      id: task.id,
      status: task.status,
      depth: task.depth,
      locationName: task.locationName,
      languageName: task.languageName,
      isShared: task.isShared,
      dfsLogin: task.dfsLogin,
      createdAt: task.createdAt,
      business: task.business,
    },
  });
}
