import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionCredentials } from "@/lib/session";
import { reviewsBatchSchema, parseBody } from "@/lib/validation";

const DFS_BASE = "https://api.dataforseo.com/v3";

// POST /api/reviews/batch — batch task_post dla wielu firm naraz (do 100 tasków w jednym POST)
export async function POST(req: NextRequest) {
  try {
    const credentials = await getSessionCredentials();
    if (!credentials) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = parseBody(reviewsBatchSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { items, languageName = "English", locationName = "Poland", depth, sortBy } = parsed.data;

    // Upsert Business records
    for (const item of items) {
      await prisma.business.upsert({
        where: { cid: item.cid },
        update: {
          ...(item.name && item.name !== "Bez nazwy" ? { name: item.name } : {}),
          ...(item.address ? { address: item.address } : {}),
        },
        create: {
          cid: item.cid,
          name: item.name || "Nieznana firma",
          address: item.address,
          dfsLogin: credentials.login,
        },
      });
    }

    // Przygotuj payloady dla DataForSEO — jeden POST z wieloma taskami
    const dfsPayload = items.map((item) => ({
      cid: item.cid,
      depth,
      sort_by: sortBy,
      language_name: languageName,
      location_name: locationName,
    }));

    const auth = Buffer.from(`${credentials.login}:${credentials.password}`).toString("base64");
    const dfsRes = await fetch(`${DFS_BASE}/business_data/google/reviews/task_post`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify(dfsPayload),
    });

    if (!dfsRes.ok) {
      throw new Error(`DataForSEO error ${dfsRes.status}: ${await dfsRes.text()}`);
    }

    const dfsData = await dfsRes.json();
    const tasks = dfsData.tasks || [];

    // Utwórz ReviewTask rekordy w DB
    const taskIds: string[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const dfsTask = tasks[i];
      const item = items[i];

      if (dfsTask.status_code !== 20100) {
        console.error(`[batch] Task failed for CID ${item.cid}:`, dfsTask.status_message);
        continue;
      }

      const business = await prisma.business.findUnique({ where: { cid: item.cid } });
      if (!business) continue;

      const reviewTask = await prisma.reviewTask.create({
        data: {
          dfsTaskId: dfsTask.id,
          businessId: business.id,
          status: "pending",
          depth,
          cost: dfsTask.cost ?? 0,
          locationName,
          languageName,
          dfsLogin: credentials.login,
        },
      });

      taskIds.push(reviewTask.id);
    }

    return NextResponse.json({
      taskIds,
      total: taskIds.length,
      totalCost: dfsData.cost ?? 0,
    });
  } catch (e) {
    console.error("[reviews/batch] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Wystąpił błąd" },
      { status: 500 }
    );
  }
}
