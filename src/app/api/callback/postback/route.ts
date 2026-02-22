import { NextRequest, NextResponse } from "next/server";
import { gunzipSync } from "zlib";
import { prisma } from "@/lib/db";
import { DFS_CALLBACK_IPS } from "@/lib/pingback";
import { processReviewResults, processSearchResults, processBusinessInfoResults } from "@/lib/task-processors";
import { DfsReview } from "@/lib/dfs/reviews";
import { DfsMapsSearchItem } from "@/lib/dfs/maps-search";
import { DfsBusinessInfo } from "@/lib/dfs/business-info";

// In-memory rate limiter: IP → { count, resetAt }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// Extract client IP from x-forwarded-for (Caddy) or fallback
function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  // Fallback — Next.js doesn't expose remote IP directly, but Caddy always sets x-forwarded-for
  return "unknown";
}

// Decompress gzip body, fallback to raw JSON if not gzipped
async function parseBody(req: NextRequest): Promise<unknown> {
  const buffer = Buffer.from(await req.arrayBuffer());

  // Check gzip magic bytes (0x1f 0x8b)
  if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
    const decompressed = gunzipSync(buffer);
    return JSON.parse(decompressed.toString("utf-8"));
  }

  // Not gzipped — try parsing as plain JSON
  return JSON.parse(buffer.toString("utf-8"));
}

// POST /api/callback/postback — DataForSEO postback handler
// DFS sends POST with gzip-compressed JSON containing full task results
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const tag = req.nextUrl.searchParams.get("tag");

  try {
    // IP allowlist — only DataForSEO servers
    if (!DFS_CALLBACK_IPS.has(ip)) {
      console.warn(`[postback] Rejected request from non-DFS IP: ${ip}`);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit
    if (!checkRateLimit(ip)) {
      console.warn(`[postback] Rate limit exceeded for IP: ${ip}`);
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    if (!tag || !["reviews", "search", "business-info"].includes(tag)) {
      console.error(`[postback] Invalid or missing tag: ${tag}`);
      // Return 200 to prevent DFS retries
      return NextResponse.json({ ok: true });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await parseBody(req) as any;
    const task = data?.tasks?.[0];

    if (!task) {
      console.error("[postback] No task in response body");
      return NextResponse.json({ ok: true });
    }

    const dfsTaskId = task.id as string;
    const statusCode = task.status_code as number;
    const cost = task.cost ?? 0;

    console.log(`[postback] Received tag=${tag} dfsTaskId=${dfsTaskId} status=${statusCode}`);

    if (statusCode !== 20000) {
      console.error(`[postback] Task ${dfsTaskId} has error status: ${statusCode} — ${task.status_message}`);
      // Mark task as failed in DB if we can find it
      await markTaskFailed(tag, dfsTaskId, task.status_message || `DFS error ${statusCode}`);
      return NextResponse.json({ ok: true });
    }

    if (tag === "reviews") {
      await handleReviewsPostback(dfsTaskId, task, cost);
    } else if (tag === "search") {
      await handleSearchPostback(dfsTaskId, task, cost);
    } else if (tag === "business-info") {
      await handleBusinessInfoPostback(dfsTaskId, task, cost);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[postback] Error processing tag=${tag} ip=${ip}:`, e);
    // Always return 200 — polling fallback will handle failures
    return NextResponse.json({ ok: true });
  }
}

async function handleReviewsPostback(dfsTaskId: string, task: Record<string, unknown>, cost: number) {
  const dbTask = await prisma.reviewTask.findFirst({
    where: { dfsTaskId },
    include: { business: true },
  });

  if (!dbTask) {
    console.warn(`[postback/reviews] No ReviewTask found for dfsTaskId: ${dfsTaskId}`);
    return;
  }

  if (dbTask.status === "completed" || dbTask.status === "failed") {
    console.log(`[postback/reviews] Task ${dfsTaskId} already ${dbTask.status}, skipping`);
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (task as any).result?.[0];
  const items: DfsReview[] = result?.items || [];

  if (items.length === 0) {
    await prisma.reviewTask.update({
      where: { id: dbTask.id },
      data: { status: "completed", cost: (dbTask.cost ?? 0) + cost },
    });
    console.log(`[postback/reviews] Task ${dfsTaskId} completed with 0 reviews`);
    return;
  }

  console.log(`[postback/reviews] Processing ${items.length} reviews for task ${dfsTaskId}`);

  await processReviewResults(
    dbTask.id,
    dbTask.businessId,
    items,
    dbTask.dfsLogin || "",
    cost,
    dbTask.cost ?? 0
  );

  console.log(`[postback/reviews] Task ${dfsTaskId} completed via postback`);
}

async function handleSearchPostback(dfsTaskId: string, task: Record<string, unknown>, cost: number) {
  const dbTask = await prisma.mapsSearchTask.findFirst({
    where: { dfsTaskId },
  });

  if (!dbTask) {
    console.warn(`[postback/search] No MapsSearchTask found for dfsTaskId: ${dfsTaskId}`);
    return;
  }

  if (dbTask.status === "completed" || dbTask.status === "failed") {
    console.log(`[postback/search] Task ${dfsTaskId} already ${dbTask.status}, skipping`);
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (task as any).result?.[0];
  const items: DfsMapsSearchItem[] = result?.items || [];

  console.log(`[postback/search] Processing ${items.length} results for task ${dfsTaskId}`);

  const savedResults = await processSearchResults(dbTask.id, items);

  await prisma.mapsSearchTask.update({
    where: { id: dbTask.id },
    data: {
      status: "completed",
      cost: (dbTask.cost ?? 0) + cost,
      resultsCount: savedResults.length,
    },
  });

  console.log(`[postback/search] Task ${dfsTaskId} completed via postback (${savedResults.length} results)`);
}

async function handleBusinessInfoPostback(dfsTaskId: string, task: Record<string, unknown>, cost: number) {
  const dbTask = await prisma.businessInfoTask.findFirst({
    where: { dfsTaskId },
    include: { business: true },
  });

  if (!dbTask) {
    console.warn(`[postback/business-info] No BusinessInfoTask found for dfsTaskId: ${dfsTaskId}`);
    return;
  }

  if (dbTask.status === "completed" || dbTask.status === "failed") {
    console.log(`[postback/business-info] Task ${dfsTaskId} already ${dbTask.status}, skipping`);
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (task as any).result?.[0];
  // task_get format: data can be directly in result[0] or in result[0].items[0]
  const info: DfsBusinessInfo = raw?.title ? raw : raw?.items?.[0] ?? raw;

  console.log(`[postback/business-info] Processing business info for task ${dfsTaskId}, title="${info?.title}"`);

  await processBusinessInfoResults(
    dfsTaskId,
    info,
    cost,
    raw,
    dbTask.cost ?? 0,
    "postback"
  );

  console.log(`[postback/business-info] Task ${dfsTaskId} completed via postback`);
}

// Mark a task as failed when DFS returns error status
async function markTaskFailed(tag: string, dfsTaskId: string, error: string) {
  try {
    if (tag === "reviews") {
      await prisma.reviewTask.updateMany({
        where: { dfsTaskId, status: { not: "completed" } },
        data: { status: "failed", error },
      });
    } else if (tag === "search") {
      await prisma.mapsSearchTask.updateMany({
        where: { dfsTaskId, status: { not: "completed" } },
        data: { status: "failed" },
      });
    } else if (tag === "business-info") {
      await prisma.businessInfoTask.updateMany({
        where: { dfsTaskId, status: { not: "completed" } },
        data: { status: "failed", error },
      });
    }
  } catch (e) {
    console.error(`[postback] Failed to mark task ${dfsTaskId} as failed:`, e);
  }
}
