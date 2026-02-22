// Shared task result processing logic — used by both polling status routes and postback handler

import { prisma } from "@/lib/db";
import { DfsReview } from "@/lib/dfs/reviews";
import { DfsMapsSearchItem } from "@/lib/dfs/maps-search";
import { DfsBusinessInfo } from "@/lib/dfs/business-info";

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

/**
 * Process review results — upsert reviews, connect to task, mark completed.
 * Used by /api/reviews/status, /api/reviews/batch/status, and postback handler.
 */
export async function processReviewResults(
  taskId: string,
  businessId: string,
  items: DfsReview[],
  dfsLogin: string,
  cost: number,
  existingCost: number = 0
): Promise<string[]> {
  const upsertedReviewIds: string[] = [];

  for (const r of items) {
    const publishedAt = r.timestamp ? new Date(r.timestamp) : null;

    const review = await prisma.review.upsert({
      where: {
        businessId_authorName_publishedAt: {
          businessId,
          authorName: r.profile_name || "Anonim",
          publishedAt: publishedAt || new Date(0),
        },
      },
      create: {
        businessId,
        authorName: r.profile_name || "Anonim",
        authorAvatar: r.profile_image_url,
        rating: r.rating?.value ?? 0,
        text: r.review_text || r.original_review_text || null,
        publishedAt,
        ownerResponse: r.owner_answer || null,
        ownerRespondedAt: r.owner_timestamp ? new Date(r.owner_timestamp) : null,
        dfsLogin,
      },
      update: {
        rating: r.rating?.value ?? 0,
        text: r.review_text || r.original_review_text || null,
        ownerResponse: r.owner_answer || null,
        ownerRespondedAt: r.owner_timestamp ? new Date(r.owner_timestamp) : null,
        authorAvatar: r.profile_image_url,
      },
      select: { id: true },
    });
    upsertedReviewIds.push(review.id);
  }

  // Connect reviews to task and mark completed
  await prisma.reviewTask.update({
    where: { id: taskId },
    data: {
      status: "completed",
      cost: existingCost + cost,
      ...(upsertedReviewIds.length > 0
        ? { reviews: { connect: upsertedReviewIds.map((id) => ({ id })) } }
        : {}),
    },
  });

  return upsertedReviewIds;
}

/**
 * Save search results — dedup by title/cid, createMany, return saved results.
 * Used by /api/search (live), /api/search/status, and postback handler.
 */
export async function processSearchResults(
  taskId: string,
  items: DfsMapsSearchItem[]
) {
  // Dedup: prefer items with CID/feature_id, filter out title-only duplicates
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
    ratingDistribution: item.rating_distribution
      ? JSON.parse(JSON.stringify(item.rating_distribution))
      : undefined,
    category: item.category,
    additionalCategories: item.additional_categories || [],
    latitude: item.latitude,
    longitude: item.longitude,
    snippet: item.snippet,
    mainImage: item.main_image,
    workHours: item.work_hours
      ? JSON.parse(JSON.stringify(item.work_hours))
      : undefined,
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

/**
 * Process business info results — update business, name/data history, mark completed.
 * Used by /api/business-info/task/status and postback handler.
 */
export async function processBusinessInfoResults(
  dfsTaskId: string,
  info: DfsBusinessInfo,
  cost: number,
  rawResult: unknown,
  existingCost: number = 0,
  source: string = "task_get"
) {
  const task = await prisma.businessInfoTask.findUnique({
    where: { dfsTaskId },
    include: { business: true },
  });

  if (!task) {
    throw new Error(`BusinessInfoTask not found for dfsTaskId: ${dfsTaskId}`);
  }

  if (!info.title) {
    await prisma.businessInfoTask.update({
      where: { dfsTaskId },
      data: {
        status: "failed",
        error: `Brak title w odpowiedzi. Keys: ${Object.keys(info || {}).join(", ")}`,
        cost: existingCost + cost,
        dfsResponse: JSON.parse(JSON.stringify(rawResult)),
      },
    });
    return { task, business: task.business, failed: true };
  }

  const oldName = task.business.name;
  const newName = info.title;

  const business = await prisma.business.update({
    where: { id: task.businessId },
    data: {
      name: newName,
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

  if (oldName !== newName) {
    await prisma.businessNameHistory.create({
      data: {
        businessId: business.id,
        name: newName,
        source,
      },
    });
  }

  await prisma.businessDataHistory.create({
    data: {
      businessId: business.id,
      name: newName,
      address: info.address,
      phone: info.phone,
      website: info.domain || info.url,
      category: info.category,
      rating: info.rating?.value,
      totalReviews: info.rating?.votes_count,
      source,
    },
  });

  await prisma.businessInfoTask.update({
    where: { dfsTaskId },
    data: {
      status: "completed",
      cost: existingCost + cost,
      dfsResponse: JSON.parse(JSON.stringify(rawResult)),
    },
  });

  return { task, business, failed: false };
}
