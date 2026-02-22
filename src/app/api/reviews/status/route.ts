import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkTasksReady, getTaskResult } from "@/lib/dataforseo";
import { getSessionCredentials } from "@/lib/session";
import { reviewsStatusSchema, parseBody } from "@/lib/validation";
import { processReviewResults } from "@/lib/task-processors";

// POST /api/reviews/status — sprawdź status taska i pobierz wyniki jeśli gotowe
export async function POST(req: NextRequest) {
  try {
    const credentials = await getSessionCredentials();
    if (!credentials) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = parseBody(reviewsStatusSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { taskId, offset, limit } = parsed.data;

    const task = await prisma.reviewTask.findUnique({
      where: { id: taskId },
      include: { business: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task nie znaleziony" }, { status: 404 });
    }

    // Jeśli task już completed — zwróć dane z DB
    if (task.status === "completed") {
      const reviews = await prisma.review.findMany({
        where: { businessId: task.businessId },
        orderBy: { publishedAt: "desc" },
        skip: offset,
        take: limit,
      });
      const total = await prisma.review.count({
        where: { businessId: task.businessId },
      });
      return NextResponse.json({ taskStatus: "completed", reviews, total });
    }

    if (task.status === "failed") {
      return NextResponse.json({ taskStatus: "failed", error: task.error });
    }

    // Grace period: don't call DFS API for tasks younger than 2 min (they're definitely not ready yet)
    const taskAgeMs = Date.now() - new Date(task.createdAt).getTime();
    const GRACE_PERIOD_MS = 2 * 60 * 1000;
    const DIRECT_FETCH_MS = 5 * 60 * 1000;

    if (taskAgeMs < GRACE_PERIOD_MS) {
      console.log(`[reviews/status] Task ${task.dfsTaskId} age=${Math.round(taskAgeMs / 1000)}s — within grace period, skipping DFS call`);
      return NextResponse.json({ taskStatus: "pending" });
    }

    // Check tasks_ready (fast path), fallback to direct task_get after 5 min
    const readyTaskIds = await checkTasksReady(credentials);
    const isReady = readyTaskIds.includes(task.dfsTaskId);

    if (!isReady && taskAgeMs < DIRECT_FETCH_MS) {
      return NextResponse.json({ taskStatus: "pending" });
    }

    if (!isReady) {
      console.log(`[reviews/status] Task ${task.dfsTaskId} not in tasks_ready (age=${Math.round(taskAgeMs / 60000)}min) — trying direct task_get`);
    }

    await prisma.reviewTask.update({
      where: { id: taskId },
      data: { status: "ready" },
    });

    const taskGetResult = await getTaskResult(credentials, task.dfsTaskId);

    // task_get returned null — task not ready yet, revert to pending
    if (!taskGetResult) {
      await prisma.reviewTask.update({ where: { id: taskId }, data: { status: "pending" } });
      return NextResponse.json({ taskStatus: "pending" });
    }

    if (!taskGetResult.reviews.items?.length) {
      await prisma.reviewTask.update({
        where: { id: taskId },
        data: { status: "completed", cost: (task.cost ?? 0) + (taskGetResult?.cost ?? 0) },
      });
      return NextResponse.json({ taskStatus: "completed", reviews: [], total: 0 });
    }

    const result = taskGetResult.reviews;
    console.log(`[reviews/status] Pobrano ${result.items.length} opinii (total: ${result.reviews_count}), koszt: $${taskGetResult.cost}`);

    // Process reviews using shared function
    await processReviewResults(
      taskId,
      task.businessId,
      result.items,
      credentials.login,
      taskGetResult.cost,
      task.cost ?? 0
    );

    // Zwróć dane z DB
    const reviews = await prisma.review.findMany({
      where: { businessId: task.businessId },
      orderBy: { publishedAt: "desc" },
      skip: offset,
      take: limit,
    });

    const total = await prisma.review.count({
      where: { businessId: task.businessId },
    });

    return NextResponse.json({ taskStatus: "completed", reviews, total });
  } catch (e) {
    console.error("[reviews/status] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Wystąpił błąd" },
      { status: 500 }
    );
  }
}
