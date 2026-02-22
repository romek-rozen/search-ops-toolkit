import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  searchMapsLive,
  postMapsSearchTask,
} from "@/lib/dataforseo";
import { getSessionCredentials } from "@/lib/session";
import { searchPostSchema, parseBody } from "@/lib/validation";
import { processSearchResults } from "@/lib/task-processors";

// POST /api/search — wyszukaj firmy na mapach Google
export async function POST(req: NextRequest) {
  try {
    const credentials = await getSessionCredentials();
    if (!credentials) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = parseBody(searchPostSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { keyword, locationCode, locationName, languageCode, depth, method, refresh } = parsed.data;

    // Sprawdź cache (ten sam keyword + location + user)
    if (!refresh) {
      const cachedTask = await prisma.mapsSearchTask.findFirst({
        where: { keyword, locationCode, languageCode, status: "completed", depth: { gte: depth }, dfsLogin: credentials.login },
        orderBy: { createdAt: "desc" },
        include: { results: { orderBy: { rankAbsolute: "asc" } } },
      });

      if (cachedTask) {
        return NextResponse.json({
          results: cachedTask.results,
          total: cachedTask.resultsCount ?? cachedTask.results.length,
          fromCache: true,
          taskId: cachedTask.id,
          taskStatus: "completed",
        });
      }
    }

    // Sprawdź czy jest pending task (dla tego usera)
    const pendingTask = await prisma.mapsSearchTask.findFirst({
      where: { keyword, locationCode, languageCode, status: "pending", dfsLogin: credentials.login },
      orderBy: { createdAt: "desc" },
    });

    if (pendingTask) {
      return NextResponse.json({
        results: [],
        total: 0,
        fromCache: false,
        taskId: pendingTask.id,
        taskStatus: "pending",
      });
    }

    if (method === "live") {
      // Live — natychmiastowe wyniki
      const { items, cost } = await searchMapsLive(credentials, keyword, locationCode, languageCode, depth);

      const task = await prisma.mapsSearchTask.create({
        data: {
          keyword, locationCode, locationName: locationName || "", languageCode,
          depth, method: "live", status: "completed", cost, resultsCount: items.length, dfsLogin: credentials.login,
        },
      });

      // Save results using shared function
      const results = await processSearchResults(task.id, items);

      return NextResponse.json({
        results,
        total: results.length,
        fromCache: false,
        taskId: task.id,
        taskStatus: "completed",
      });
    } else {
      // Async (standard priority=1, priority priority=2)
      const priority = method === "priority" ? 2 : 1;
      const { dfsTaskId, cost } = await postMapsSearchTask(credentials, keyword, locationCode, languageCode, depth, priority as 1 | 2);

      const task = await prisma.mapsSearchTask.create({
        data: {
          dfsTaskId, keyword, locationCode, locationName: locationName || "",
          languageCode, depth, method, status: "pending", cost, dfsLogin: credentials.login,
        },
      });

      return NextResponse.json({
        results: [],
        total: 0,
        fromCache: false,
        taskId: task.id,
        taskStatus: "pending",
      });
    }
  } catch (e) {
    console.error("[search] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Wystąpił błąd" },
      { status: 500 }
    );
  }
}
