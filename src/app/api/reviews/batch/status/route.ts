import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkTasksReady, getTaskResult } from "@/lib/dataforseo";
import { getSessionCredentials } from "@/lib/session";
import { reviewsBatchStatusSchema, parseBody } from "@/lib/validation";

// POST /api/reviews/batch/status — sprawdź status wielu tasków naraz
export async function POST(req: NextRequest) {
  try {
    const credentials = await getSessionCredentials();
    if (!credentials) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = parseBody(reviewsBatchStatusSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { taskIds } = parsed.data;

    // Pobierz taski z DB
    const tasks = await prisma.reviewTask.findMany({
      where: { id: { in: taskIds } },
      include: { business: { select: { cid: true, name: true } } },
    });

    const statusMap: Record<string, { status: string; reviewsCount?: number; businessCid?: string; businessName?: string }> = {};
    const pendingDfsTaskIds: string[] = [];

    for (const task of tasks) {
      if (task.status === "completed" || task.status === "failed") {
        const reviewsCount = await prisma.review.count({
          where: { tasks: { some: { id: task.id } } },
        });
        statusMap[task.id] = {
          status: task.status,
          reviewsCount,
          businessCid: task.business.cid,
          businessName: task.business.name,
        };
      } else {
        statusMap[task.id] = {
          status: "pending",
          businessCid: task.business.cid,
          businessName: task.business.name,
        };
        if (task.dfsTaskId) pendingDfsTaskIds.push(task.dfsTaskId);
      }
    }

    // Check tasks_ready first, fallback to direct task_get after 5 min per task
    if (pendingDfsTaskIds.length > 0) {
      const readyIds = await checkTasksReady(credentials);
      const DIRECT_FETCH_MS = 5 * 60 * 1000;

      for (const task of tasks) {
        if (task.status !== "pending" || !task.dfsTaskId) continue;
        const isReady = readyIds.includes(task.dfsTaskId);
        const taskAgeMs = Date.now() - new Date(task.createdAt).getTime();

        // Skip if not ready and not old enough for direct fetch
        if (!isReady && taskAgeMs < DIRECT_FETCH_MS) continue;

        if (!isReady) {
          console.log(`[reviews/batch/status] Task ${task.dfsTaskId} not in tasks_ready (age=${Math.round(taskAgeMs / 60000)}min) — trying direct task_get`);
        }

        const result = await getTaskResult(credentials, task.dfsTaskId);
        if (!result) {
          // Not ready yet — stay pending (don't mark as failed)
          continue;
        }

        // Upsert recenzje
        const reviews = result.reviews.items || [];
        const connectedIds: string[] = [];

        for (const rev of reviews) {
          const publishedAt = rev.timestamp ? new Date(rev.timestamp) : null;
          const review = await prisma.review.upsert({
            where: {
              businessId_authorName_publishedAt: {
                businessId: task.businessId,
                authorName: rev.profile_name || "Anonim",
                publishedAt: publishedAt ?? new Date(0),
              },
            },
            update: {
              text: rev.review_text || rev.original_review_text,
              rating: rev.rating?.value ?? 0,
              ownerResponse: rev.owner_answer,
              ownerRespondedAt: rev.owner_timestamp ? new Date(rev.owner_timestamp) : null,
              authorAvatar: rev.profile_image_url,
            },
            create: {
              businessId: task.businessId,
              authorName: rev.profile_name || "Anonim",
              rating: rev.rating?.value ?? 0,
              text: rev.review_text || rev.original_review_text,
              publishedAt,
              ownerResponse: rev.owner_answer,
              ownerRespondedAt: rev.owner_timestamp ? new Date(rev.owner_timestamp) : null,
              authorAvatar: rev.profile_image_url,
              dfsLogin: credentials.login,
            },
          });
          connectedIds.push(review.id);
        }

        // Powiąż recenzje z taskiem
        await prisma.reviewTask.update({
          where: { id: task.id },
          data: {
            status: "completed",
            cost: result.cost,
            reviews: { connect: connectedIds.map((id) => ({ id })) },
          },
        });

        statusMap[task.id] = {
          ...statusMap[task.id],
          status: "completed",
          reviewsCount: connectedIds.length,
        };
      }
    }

    const completed = Object.values(statusMap).filter((s) => s.status === "completed").length;
    const pending = Object.values(statusMap).filter((s) => s.status === "pending").length;

    return NextResponse.json({ statusMap, completed, pending, total: tasks.length });
  } catch (e) {
    console.error("[reviews/batch/status] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Wystąpił błąd" },
      { status: 500 }
    );
  }
}
