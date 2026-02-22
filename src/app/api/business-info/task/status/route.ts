import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  checkBusinessInfoTasksReady,
  getBusinessInfoTaskResult,
} from "@/lib/dataforseo";
import { getSessionCredentials } from "@/lib/session";
import { businessInfoTaskStatusSchema, parseBody } from "@/lib/validation";
import { processBusinessInfoResults } from "@/lib/task-processors";

export async function POST(req: NextRequest) {
  try {
    const credentials = await getSessionCredentials();
    if (!credentials) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = parseBody(businessInfoTaskStatusSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { dfsTaskId } = parsed.data;

    // Znajdź task w DB
    const task = await prisma.businessInfoTask.findUnique({
      where: { dfsTaskId },
      include: { business: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task nie znaleziony" }, { status: 404 });
    }

    if (task.status === "completed") {
      return NextResponse.json({
        taskStatus: "completed",
        business: task.business,
      });
    }

    if (task.status === "failed") {
      return NextResponse.json({
        taskStatus: "failed",
        error: task.error,
      });
    }

    // Grace period: don't call DFS API for tasks younger than 2 min (they're definitely not ready yet)
    const taskAgeMs = Date.now() - new Date(task.createdAt).getTime();
    const GRACE_PERIOD_MS = 2 * 60 * 1000;
    const DIRECT_FETCH_MS = 5 * 60 * 1000;

    if (taskAgeMs < GRACE_PERIOD_MS) {
      console.log(`[business-info/task/status] Task ${dfsTaskId} age=${Math.round(taskAgeMs / 1000)}s — within grace period, skipping DFS call`);
      return NextResponse.json({ taskStatus: "pending" });
    }

    // Check tasks_ready first, fallback to direct task_get after 5 min
    const readyIds = await checkBusinessInfoTasksReady(credentials);
    const isReady = readyIds.includes(dfsTaskId);

    if (!isReady && taskAgeMs < DIRECT_FETCH_MS) {
      return NextResponse.json({ taskStatus: "pending" });
    }

    if (!isReady) {
      console.log(`[business-info/task/status] Task ${dfsTaskId} not in tasks_ready (age=${Math.round(taskAgeMs / 60000)}min) — trying direct task_get`);
    }

    const result = await getBusinessInfoTaskResult(credentials, dfsTaskId);

    if (!result) {
      // Not ready yet — stay pending
      return NextResponse.json({ taskStatus: "pending" });
    }

    console.log("[business-info/task/status] Parsed info:", JSON.stringify(result.info)?.slice(0, 300));

    const { business, failed } = await processBusinessInfoResults(
      dfsTaskId,
      result.info,
      result.cost,
      result.rawResult,
      task.cost ?? 0,
      "task_get"
    );

    if (failed) {
      return NextResponse.json({
        taskStatus: "failed",
        error: "Brak danych o firmie",
        business: task.business,
      });
    }

    return NextResponse.json({
      taskStatus: "completed",
      business,
    });
  } catch (e) {
    console.error("[business-info/task/status] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Wystąpił błąd" },
      { status: 500 }
    );
  }
}
