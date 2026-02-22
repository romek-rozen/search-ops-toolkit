import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { postReviewsTask } from "@/lib/dataforseo";
import { getSessionCredentials } from "@/lib/session";
import { reviewsPostSchema, parseBody } from "@/lib/validation";

// POST /api/reviews — pobierz opinie z cache lub utwórz task w DataForSEO
export async function POST(req: NextRequest) {
  try {
    const credentials = await getSessionCredentials();
    if (!credentials) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = parseBody(reviewsPostSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { cid, refresh, offset, limit, depth, sortBy, languageName, locationName } = parsed.data;
    const business = await prisma.business.findUnique({ where: { cid } });

    // Sprawdź cache — jeśli mamy opinie i nie odświeżamy
    if (!refresh && business) {
      const cachedReviews = await prisma.review.findMany({
        where: { businessId: business.id },
        orderBy: { publishedAt: "desc" },
        skip: offset,
        take: limit,
      });

      if (cachedReviews.length > 0) {
        const total = await prisma.review.count({
          where: { businessId: business.id },
        });
        return NextResponse.json({
          reviews: cachedReviews,
          total,
          fromCache: true,
          taskStatus: "completed",
        });
      }
    }

    if (!business) {
      return NextResponse.json(
        { error: "Firma nie znaleziona w bazie. Najpierw pobierz info o firmie." },
        { status: 404 }
      );
    }

    // Sprawdź czy istnieje pending task dla tego biznesu
    const existingTask = await prisma.reviewTask.findFirst({
      where: {
        businessId: business.id,
        status: { in: ["pending", "ready"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingTask) {
      return NextResponse.json({
        reviews: [],
        total: 0,
        fromCache: false,
        taskStatus: existingTask.status,
        taskId: existingTask.id,
      });
    }

    // Utwórz nowy task w DataForSEO
    const dfsResult = await postReviewsTask(credentials, cid, depth, sortBy, languageName || "English", locationName || "Poland");

    // Zapisz task w DB z pełnymi danymi z DataForSEO
    const taskData = dfsResult.data;
    const task = await prisma.reviewTask.create({
      data: {
        dfsTaskId: dfsResult.dfsTaskId,
        businessId: business.id,
        status: "pending",
        depth,
        cost: dfsResult.cost,
        timeSec: dfsResult.timeSec,
        dfsStatusCode: dfsResult.dfsStatusCode,
        locationName: taskData.location_name as string | undefined,
        languageName: taskData.language_name as string | undefined,
        keyword: taskData.keyword as string | undefined,
        device: taskData.device as string | undefined,
        os: taskData.os as string | undefined,
        dfsLogin: credentials.login,
        dfsResponse: JSON.parse(JSON.stringify(dfsResult.fullResponse)),
      },
    });

    return NextResponse.json({
      reviews: [],
      total: 0,
      fromCache: false,
      taskStatus: "pending",
      taskId: task.id,
    });
  } catch (e) {
    console.error("[reviews] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Wystąpił błąd" },
      { status: 500 }
    );
  }
}
