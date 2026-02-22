import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionCredentials, isAdmin } from "@/lib/session";
import { shareToggleSchema, parseBody } from "@/lib/validation";

// PATCH /api/share — toggle isShared on a task (owner or admin only)
export async function PATCH(req: NextRequest) {
  const credentials = await getSessionCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = parseBody(shareToggleSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { taskId, taskType, isShared } = parsed.data;
  const { login } = credentials;

  if (taskType === "review") {
    const task = await prisma.reviewTask.findUnique({ where: { id: taskId } });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    // Only owner or admin can toggle sharing
    if (task.dfsLogin !== login && !isAdmin(login)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await prisma.reviewTask.update({ where: { id: taskId }, data: { isShared } });
  } else {
    const task = await prisma.mapsSearchTask.findUnique({ where: { id: taskId } });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    if (task.dfsLogin !== login && !isAdmin(login)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await prisma.mapsSearchTask.update({ where: { id: taskId }, data: { isShared } });
  }

  return NextResponse.json({ ok: true, isShared });
}
