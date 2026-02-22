import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  checkTasksReady,
  checkMapsSearchTasksReady,
  checkBusinessInfoTasksReady,
} from "@/lib/dataforseo";
import { getSessionCredentials, isAdmin } from "@/lib/session";
import { retryReviewTask, retrySearchTask, retryInfoTask } from "@/lib/task-retry";

// POST /api/tasks/retry-all — check all pending tasks for current user and fetch results if ready
export async function POST() {
  try {
    const credentials = await getSessionCredentials();
    if (!credentials) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userFilter = isAdmin(credentials.login) ? {} : { dfsLogin: credentials.login };
    const results = { completed: 0, pending: 0, failed: 0 };

    // Fetch all pending tasks
    const [pendingReviews, pendingSearch, pendingInfo] = await Promise.all([
      prisma.reviewTask.findMany({ where: { status: { in: ["pending", "ready"] }, ...userFilter } }),
      prisma.mapsSearchTask.findMany({ where: { status: { in: ["pending", "ready"] }, ...userFilter } }),
      prisma.businessInfoTask.findMany({ where: { status: { in: ["pending", "ready"] }, ...userFilter } }),
    ]);

    const totalPending = pendingReviews.length + pendingSearch.length + pendingInfo.length;
    console.log(`[tasks/retry-all] Pending tasks: ${pendingReviews.length} reviews, ${pendingSearch.length} search, ${pendingInfo.length} info`);

    if (totalPending === 0) {
      return NextResponse.json({ message: "Brak pending tasków", results });
    }

    // Log pending task IDs
    for (const t of pendingSearch) console.log(`[tasks/retry-all] Pending search: DB=${t.id}, DFS=${t.dfsTaskId}`);
    for (const t of pendingInfo) console.log(`[tasks/retry-all] Pending info: DB=${t.id}, DFS=${t.dfsTaskId}`);
    for (const t of pendingReviews) console.log(`[tasks/retry-all] Pending review: DB=${t.id}, DFS=${t.dfsTaskId}`);

    // Check ready tasks from DFS API (one call per type that has pending tasks)
    const [readyReviewIds, readySearchItems, readyInfoIds] = await Promise.all([
      pendingReviews.length > 0 ? checkTasksReady(credentials) : Promise.resolve([] as string[]),
      pendingSearch.length > 0 ? checkMapsSearchTasksReady(credentials) : Promise.resolve([]),
      pendingInfo.length > 0 ? checkBusinessInfoTasksReady(credentials) : Promise.resolve([] as string[]),
    ]);

    // Log what DFS API says is ready
    console.log(`[tasks/retry-all] DFS ready: reviews=${JSON.stringify(readyReviewIds)}, search=${JSON.stringify(readySearchItems.map(r => r.id))}, info=${JSON.stringify(readyInfoIds)}`);

    // Process only tasks that are ready (skip DFS call for not-ready ones)
    for (const task of pendingReviews) {
      if (!readyReviewIds.includes(task.dfsTaskId)) {
        results.pending++;
        continue;
      }
      try {
        const res = await retryReviewTask(task.id, credentials, readyReviewIds);
        if (res.taskStatus === "completed") results.completed++;
        else if (res.taskStatus === "failed") results.failed++;
        else results.pending++;
      } catch {
        results.pending++;
      }
    }

    for (const task of pendingSearch) {
      const isReady = readySearchItems.some((r) => r.id === task.dfsTaskId);
      if (!isReady) {
        results.pending++;
        continue;
      }
      try {
        const res = await retrySearchTask(task.id, credentials, readySearchItems.map(r => r.id));
        if (res.taskStatus === "completed") results.completed++;
        else if (res.taskStatus === "failed") results.failed++;
        else results.pending++;
      } catch {
        results.pending++;
      }
    }

    for (const task of pendingInfo) {
      if (!readyInfoIds.includes(task.dfsTaskId)) {
        results.pending++;
        continue;
      }
      try {
        const res = await retryInfoTask(task.id, credentials, readyInfoIds);
        if (res.taskStatus === "completed") results.completed++;
        else if (res.taskStatus === "failed") results.failed++;
        else results.pending++;
      } catch {
        results.pending++;
      }
    }

    return NextResponse.json({ results });
  } catch (e) {
    console.error("[tasks/retry-all] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Wystąpił błąd" },
      { status: 500 }
    );
  }
}
