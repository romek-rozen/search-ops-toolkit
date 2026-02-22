import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkMapsSearchTasksReady, getMapsSearchTaskResult } from "@/lib/dataforseo";
import { getSessionCredentials } from "@/lib/session";
import { searchStatusSchema, parseBody } from "@/lib/validation";
import { processSearchResults } from "@/lib/task-processors";

// POST /api/search/status — sprawdź status async taska wyszukiwania
export async function POST(req: NextRequest) {
  try {
    const credentials = await getSessionCredentials();
    if (!credentials) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = parseBody(searchStatusSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { taskId } = parsed.data;

    const task = await prisma.mapsSearchTask.findUnique({
      where: { id: taskId },
      include: { results: { orderBy: { rankAbsolute: "asc" } } },
    });

    if (!task) {
      return NextResponse.json({ error: "Task nie znaleziony" }, { status: 404 });
    }

    if (task.status === "completed") {
      return NextResponse.json({
        taskStatus: "completed",
        results: task.results,
        total: task.results.length,
      });
    }

    if (task.status === "failed") {
      return NextResponse.json({ taskStatus: "failed" });
    }

    // Grace period: don't call DFS API for tasks younger than 2 min (they're definitely not ready yet)
    const taskAgeMs = Date.now() - new Date(task.createdAt).getTime();
    const GRACE_PERIOD_MS = 2 * 60 * 1000;
    const DIRECT_FETCH_MS = 5 * 60 * 1000;

    if (taskAgeMs < GRACE_PERIOD_MS) {
      console.log(`[search/status] Task ${task.dfsTaskId} age=${Math.round(taskAgeMs / 1000)}s — within grace period, skipping DFS call`);
      return NextResponse.json({ taskStatus: "pending" });
    }

    // Check tasks_ready first, fallback to direct task_get after 5 min
    const readyTasks = await checkMapsSearchTasksReady(credentials);
    const readyItem = readyTasks.find((t) => t.id === task.dfsTaskId);

    if (!readyItem && taskAgeMs < DIRECT_FETCH_MS) {
      return NextResponse.json({ taskStatus: "pending" });
    }

    if (!readyItem) {
      console.log(`[search/status] Task ${task.dfsTaskId} not in tasks_ready (age=${Math.round(taskAgeMs / 60000)}min) — trying direct task_get`);
    }

    const result = await getMapsSearchTaskResult(credentials, task.dfsTaskId!);

    if (!result) {
      // Not ready yet — stay pending (don't mark as failed)
      return NextResponse.json({ taskStatus: "pending" });
    }

    // Save results using shared function
    const savedResults = await processSearchResults(task.id, result.items);

    await prisma.mapsSearchTask.update({
      where: { id: taskId },
      data: {
        status: "completed",
        cost: (task.cost ?? 0) + result.cost,
        resultsCount: savedResults.length,
      },
    });

    return NextResponse.json({
      taskStatus: "completed",
      results: savedResults,
      total: savedResults.length,
    });
  } catch (e) {
    console.error("[search/status] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Wystąpił błąd" },
      { status: 500 }
    );
  }
}
