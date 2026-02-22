import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { taskId, businessName, reviews, webhookUrl } = body;

  if (!webhookUrl) {
    return NextResponse.json({ error: "webhookUrl is required" }, { status: 400 });
  }

  // If reviews not provided but taskId is, fetch from DB
  let reviewsPayload = reviews;
  let resolvedBusinessName = businessName;

  if ((!reviewsPayload || !Array.isArray(reviewsPayload) || reviewsPayload.length === 0) && taskId) {
    const task = await prisma.reviewTask.findUnique({
      where: { id: taskId },
      include: {
        reviews: true,
        business: { select: { name: true } },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    reviewsPayload = task.reviews.map((r: { authorName: string; rating: number; publishedAt: Date | null; text: string | null; ownerResponse: string | null }) => ({
      authorName: r.authorName,
      rating: r.rating,
      publishedAt: r.publishedAt,
      text: r.text,
      ownerResponse: r.ownerResponse,
    }));
    resolvedBusinessName = resolvedBusinessName || task.business?.name;
  }

  if (!reviewsPayload || !Array.isArray(reviewsPayload)) {
    return NextResponse.json({ error: "reviews array is required" }, { status: 400 });
  }

  try {
    const webhookRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "reviews",
        taskId,
        businessName: resolvedBusinessName,
        reviews: reviewsPayload,
      }),
    });

    return NextResponse.json({
      success: webhookRes.ok,
      status: webhookRes.status,
      statusText: webhookRes.statusText,
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : "Webhook request failed",
    }, { status: 502 });
  }
}
