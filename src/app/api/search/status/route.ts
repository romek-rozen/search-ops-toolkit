import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkMapsSearchTasksReady, getMapsSearchTaskResult, DfsMapsSearchItem } from "@/lib/dataforseo";
import { getSessionCredentials } from "@/lib/session";
import { searchStatusSchema, parseBody } from "@/lib/validation";

// Extract CID from DataForSEO feature_id (hex format 0x...:0x...)
function extractCidFromFeatureId(featureId?: string | null): string | null {
  if (!featureId) return null;
  const match = featureId.match(/0x[0-9a-fA-F]+:(0x[0-9a-fA-F]+)/);
  if (!match) return null;
  try {
    return BigInt(match[1]).toString();
  } catch {
    return null;
  }
}

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

    // Zapisz wyniki
    const savedResults = await saveSearchResults(task.id, result.items);

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

async function saveSearchResults(taskId: string, items: DfsMapsSearchItem[]) {
  const titlesWithCid = new Set(
    items.filter((i) => i.cid || i.feature_id).map((i) => i.title?.toLowerCase())
  );
  const deduped = items.filter((item) => {
    if (item.cid || item.feature_id) return true;
    return !titlesWithCid.has(item.title?.toLowerCase());
  });

  const data = deduped.map((item, index) => ({
    taskId,
    rankAbsolute: item.rank_absolute ?? index + 1,
    title: item.title || "Bez nazwy",
    address: item.address,
    city: item.address_info?.city ?? null,
    country: item.address_info?.country_code ?? null,
    phone: item.phone,
    domain: item.domain,
    url: item.url,
    cid: item.cid || extractCidFromFeatureId(item.feature_id),
    placeId: item.place_id,
    rating: item.rating?.value,
    votesCount: item.rating?.votes_count,
    ratingDistribution: item.rating_distribution ? JSON.parse(JSON.stringify(item.rating_distribution)) : undefined,
    category: item.category,
    additionalCategories: item.additional_categories || [],
    latitude: item.latitude,
    longitude: item.longitude,
    snippet: item.snippet,
    mainImage: item.main_image,
    workHours: item.work_hours ? JSON.parse(JSON.stringify(item.work_hours)) : undefined,
    priceLevel: item.price_level,
    isClaimed: item.is_claimed,
    featureId: item.feature_id,
    type: item.type,
  }));

  await prisma.mapsSearchResult.createMany({ data });

  return prisma.mapsSearchResult.findMany({
    where: { taskId },
    orderBy: { rankAbsolute: "asc" },
  });
}
