import { prisma } from "@/lib/db";
import {
  checkTasksReady,
  getTaskResult,
  checkMapsSearchTasksReady,
  getMapsSearchTaskResult,
  checkBusinessInfoTasksReady,
  getBusinessInfoTaskResult,
  DfsMapsSearchItem,
} from "@/lib/dataforseo";

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

type Credentials = { login: string; password: string };
type RetryResult = { taskStatus: "completed" | "pending" | "failed"; error?: string };

// After this threshold, try task_get directly (bypass tasks_ready)
const DIRECT_FETCH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
// After this threshold, mark as failed if task_get also returns nothing
const EXPIRE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (DFS keeps results for 30 days)

function taskAgeMs(createdAt: Date): number {
  return Date.now() - createdAt.getTime();
}

export async function retryReviewTask(taskId: string, credentials: Credentials, readyIds?: string[], force?: boolean): Promise<RetryResult> {
  console.log(`[retry:review] Starting retry for DB=${taskId}`);
  const task = await prisma.reviewTask.findUnique({
    where: { id: taskId },
    include: { business: true },
  });

  if (!task) { console.log(`[retry:review] Task ${taskId} not found`); return { taskStatus: "failed", error: "Task nie znaleziony" }; }
  if (task.status === "completed") { console.log(`[retry:review] Task ${taskId} already completed`); return { taskStatus: "completed" }; }
  if (task.status === "failed") { console.log(`[retry:review] Task ${taskId} already failed: ${task.error}`); return { taskStatus: "failed", error: task.error || undefined }; }

  // Use pre-fetched readyIds if provided, otherwise fetch from DFS API
  const resolvedReadyIds = readyIds ?? await (async () => {
    console.log(`[retry:review] Task DB=${taskId} DFS=${task.dfsTaskId} business=${task.business?.name} — checking tasks_ready`);
    const ids = await checkTasksReady(credentials);
    console.log(`[retry:review] Ready IDs from DFS: [${ids.join(", ")}]`);
    return ids;
  })();
  const isReady = resolvedReadyIds.includes(task.dfsTaskId);
  const age = taskAgeMs(task.createdAt);
  const canDirectFetch = force || age > DIRECT_FETCH_THRESHOLD_MS;
  const expired = age > EXPIRE_THRESHOLD_MS;

  if (!isReady && !canDirectFetch) { console.log(`[retry:review] Task ${task.dfsTaskId} NOT in ready list`); return { taskStatus: "pending" }; }

  if (!isReady && canDirectFetch) {
    console.log(`[retry:review] Task ${task.dfsTaskId} age=${Math.round(age / 60000)}min — trying direct task_get`);
  } else {
    console.log(`[retry:review] Task ${task.dfsTaskId} IS ready — fetching results`);
  }
  await prisma.reviewTask.update({ where: { id: taskId }, data: { status: "ready" } });

  const taskGetResult = await getTaskResult(credentials, task.dfsTaskId);

  if (!taskGetResult) {
    if (expired) {
      console.log(`[retry:review] Task ${task.dfsTaskId} — expired (${Math.round(age / 60000)}min) + task_get null, marking FAILED`);
      await prisma.reviewTask.update({
        where: { id: taskId },
        data: { status: "failed", error: "Task wygasł w DataForSEO (brak wyników po >60 min)" },
      });
      return { taskStatus: "failed", error: "Task wygasł w DataForSEO" };
    }
    // Not expired yet — revert to pending, will retry next time
    console.log(`[retry:review] Task ${task.dfsTaskId} — task_get returned null, back to pending`);
    await prisma.reviewTask.update({ where: { id: taskId }, data: { status: "pending" } });
    return { taskStatus: "pending" };
  }

  if (!taskGetResult.reviews.items?.length) {
    console.log(`[retry:review] Task ${task.dfsTaskId} — no reviews returned, marking completed`);
    await prisma.reviewTask.update({
      where: { id: taskId },
      data: { status: "completed", cost: (task.cost ?? 0) + (taskGetResult.cost ?? 0) },
    });
    return { taskStatus: "completed" };
  }

  const result = taskGetResult.reviews;
  console.log(`[retry:review] Task ${task.dfsTaskId} — got ${result.items.length} reviews, cost=$${taskGetResult.cost}`);
  const upsertedReviewIds: string[] = [];
  for (const r of result.items) {
    const publishedAt = r.timestamp ? new Date(r.timestamp) : null;
    const review = await prisma.review.upsert({
      where: {
        businessId_authorName_publishedAt: {
          businessId: task.businessId,
          authorName: r.profile_name || "Anonim",
          publishedAt: publishedAt || new Date(0),
        },
      },
      create: {
        businessId: task.businessId,
        authorName: r.profile_name || "Anonim",
        authorAvatar: r.profile_image_url,
        rating: r.rating?.value ?? 0,
        text: r.review_text || r.original_review_text || null,
        publishedAt,
        ownerResponse: r.owner_answer || null,
        ownerRespondedAt: r.owner_timestamp ? new Date(r.owner_timestamp) : null,
        dfsLogin: credentials.login,
      },
      update: {
        rating: r.rating?.value ?? 0,
        text: r.review_text || r.original_review_text || null,
        ownerResponse: r.owner_answer || null,
        ownerRespondedAt: r.owner_timestamp ? new Date(r.owner_timestamp) : null,
      },
      select: { id: true },
    });
    upsertedReviewIds.push(review.id);
  }

  if (upsertedReviewIds.length > 0) {
    await prisma.reviewTask.update({
      where: { id: taskId },
      data: { reviews: { connect: upsertedReviewIds.map((id) => ({ id })) } },
    });
  }

  await prisma.reviewTask.update({
    where: { id: taskId },
    data: { status: "completed", cost: (task.cost ?? 0) + taskGetResult.cost },
  });

  console.log(`[retry:review] Task ${taskId} COMPLETED — ${upsertedReviewIds.length} reviews saved`);
  return { taskStatus: "completed" };
}

export async function retrySearchTask(taskId: string, credentials: Credentials, readyIds?: string[], force?: boolean): Promise<RetryResult> {
  console.log(`[retry:search] Starting retry for DB=${taskId}`);
  const task = await prisma.mapsSearchTask.findUnique({ where: { id: taskId } });

  if (!task) { console.log(`[retry:search] Task ${taskId} not found`); return { taskStatus: "failed", error: "Task nie znaleziony" }; }
  if (task.status === "completed") { console.log(`[retry:search] Task ${taskId} already completed`); return { taskStatus: "completed" }; }
  if (task.status === "failed") { console.log(`[retry:search] Task ${taskId} already failed`); return { taskStatus: "failed" }; }

  // Use pre-fetched readyIds if provided, otherwise fetch from DFS API
  let readyItem: { id: string } | undefined;
  if (readyIds) {
    readyItem = readyIds.includes(task.dfsTaskId!) ? { id: task.dfsTaskId! } : undefined;
  } else {
    console.log(`[retry:search] Task DB=${taskId} DFS=${task.dfsTaskId} keyword="${task.keyword}" — checking tasks_ready`);
    const readyTasks = await checkMapsSearchTasksReady(credentials);
    console.log(`[retry:search] Ready IDs from DFS: [${readyTasks.map(r => r.id).join(", ")}]`);
    readyItem = readyTasks.find((t) => t.id === task.dfsTaskId);
  }
  const searchAge = taskAgeMs(task.createdAt);
  const searchCanDirect = force || searchAge > DIRECT_FETCH_THRESHOLD_MS;
  const searchExpired = searchAge > EXPIRE_THRESHOLD_MS;

  if (!readyItem && !searchCanDirect) { console.log(`[retry:search] Task ${task.dfsTaskId} NOT in ready list`); return { taskStatus: "pending" }; }

  if (!readyItem && searchCanDirect) {
    console.log(`[retry:search] Task ${task.dfsTaskId} age=${Math.round(searchAge / 60000)}min — trying direct task_get`);
  } else {
    console.log(`[retry:search] Task ${task.dfsTaskId} IS ready — fetching results`);
  }

  const result = await getMapsSearchTaskResult(credentials, task.dfsTaskId!);

  if (!result) {
    if (searchExpired) {
      const msg = "Task wygasł w DataForSEO (brak wyników po >60 min)";
      console.log(`[retry:search] Task ${task.dfsTaskId} — ${msg}, marking failed`);
      await prisma.mapsSearchTask.update({ where: { id: taskId }, data: { status: "failed", dfsResponse: { error: msg } } });
      return { taskStatus: "failed", error: msg };
    }
    console.log(`[retry:search] Task ${task.dfsTaskId} — task_get returned null, back to pending`);
    return { taskStatus: "pending" };
  }

  const items: DfsMapsSearchItem[] = result.items;
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
  }));

  console.log(`[retry:search] Task ${task.dfsTaskId} — got ${result.items.length} items, deduped to ${data.length}, cost=$${result.cost}`);
  await prisma.mapsSearchResult.createMany({ data });

  await prisma.mapsSearchTask.update({
    where: { id: taskId },
    data: {
      status: "completed",
      cost: (task.cost ?? 0) + result.cost,
      resultsCount: data.length,
    },
  });

  console.log(`[retry:search] Task ${taskId} COMPLETED — ${data.length} results saved`);
  return { taskStatus: "completed" };
}

export async function retryInfoTask(taskId: string, credentials: Credentials, preReadyIds?: string[], force?: boolean): Promise<RetryResult> {
  console.log(`[retry:info] Starting retry for DB=${taskId}`);
  const task = await prisma.businessInfoTask.findUnique({
    where: { id: taskId },
    include: { business: true },
  });

  if (!task) { console.log(`[retry:info] Task ${taskId} not found`); return { taskStatus: "failed", error: "Task nie znaleziony" }; }
  if (task.status === "completed") { console.log(`[retry:info] Task ${taskId} already completed`); return { taskStatus: "completed" }; }
  if (task.status === "failed") { console.log(`[retry:info] Task ${taskId} already failed: ${task.error}`); return { taskStatus: "failed", error: task.error || undefined }; }

  // Use pre-fetched readyIds if provided, otherwise fetch from DFS API
  const resolvedReadyIds = preReadyIds ?? await (async () => {
    console.log(`[retry:info] Task DB=${taskId} DFS=${task.dfsTaskId} business=${task.business?.name} — checking tasks_ready`);
    const ids = await checkBusinessInfoTasksReady(credentials);
    console.log(`[retry:info] Ready IDs from DFS: [${ids.join(", ")}]`);
    return ids;
  })();
  const infoReady = resolvedReadyIds.includes(task.dfsTaskId);
  const infoAge = taskAgeMs(task.createdAt);
  const infoCanDirect = force || infoAge > DIRECT_FETCH_THRESHOLD_MS;
  const infoExpired = infoAge > EXPIRE_THRESHOLD_MS;

  if (!infoReady && !infoCanDirect) { console.log(`[retry:info] Task ${task.dfsTaskId} NOT in ready list`); return { taskStatus: "pending" }; }

  if (!infoReady && infoCanDirect) {
    console.log(`[retry:info] Task ${task.dfsTaskId} age=${Math.round(infoAge / 60000)}min — trying direct task_get`);
  } else {
    console.log(`[retry:info] Task ${task.dfsTaskId} IS ready — fetching results`);
  }
  const result = await getBusinessInfoTaskResult(credentials, task.dfsTaskId);

  if (!result || !result.info?.title) {
    // If not expired yet and task_get returned nothing, stay pending
    if (!result && !infoExpired) {
      console.log(`[retry:info] Task ${task.dfsTaskId} — task_get returned null, back to pending`);
      return { taskStatus: "pending" };
    }
    const errorMsg = result ? `Brak title. Keys: ${Object.keys(result.info || {}).join(", ")}` : "Task wygasł w DataForSEO (brak wyników po >60 min)";
    console.log(`[retry:info] Task ${task.dfsTaskId} — ${errorMsg}, marking failed`);
    await prisma.businessInfoTask.update({
      where: { id: taskId },
      data: {
        status: "failed",
        error: errorMsg,
        cost: result?.cost,
        dfsResponse: result ? JSON.parse(JSON.stringify(result.rawResult)) : undefined,
      },
    });
    return { taskStatus: "failed", error: errorMsg };
  }

  const info = result.info;
  const oldName = task.business.name;

  await prisma.business.update({
    where: { id: task.businessId },
    data: {
      name: info.title,
      address: info.address,
      city: info.address_info?.city ?? null,
      country: info.address_info?.country_code ?? null,
      phone: info.phone,
      website: info.domain || info.url,
      category: info.category,
      rating: info.rating?.value,
      totalReviews: info.rating?.votes_count,
    },
  });

  if (oldName !== info.title) {
    await prisma.businessNameHistory.create({
      data: { businessId: task.businessId, name: info.title, source: "task_get" },
    });
  }

  await prisma.businessDataHistory.create({
    data: {
      businessId: task.businessId,
      name: info.title,
      address: info.address,
      phone: info.phone,
      website: info.domain || info.url,
      category: info.category,
      rating: info.rating?.value,
      totalReviews: info.rating?.votes_count,
      source: "task_get",
    },
  });

  await prisma.businessInfoTask.update({
    where: { id: taskId },
    data: {
      status: "completed",
      cost: (task.cost ?? 0) + result.cost,
      dfsResponse: JSON.parse(JSON.stringify(result.rawResult)),
    },
  });

  console.log(`[retry:info] Task ${taskId} COMPLETED — business="${info.title}" cost=$${result.cost}`);
  return { taskStatus: "completed" };
}
