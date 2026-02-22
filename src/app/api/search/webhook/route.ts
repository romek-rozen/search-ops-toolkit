import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { taskId, results, webhookUrl } = body;

  if (!webhookUrl) {
    return NextResponse.json({ error: "webhookUrl is required" }, { status: 400 });
  }

  let payload;

  if (results && Array.isArray(results)) {
    // Send provided results directly
    payload = results;
  } else if (taskId) {
    // Fetch from DB
    const dbResults = await prisma.mapsSearchResult.findMany({
      where: { taskId },
      orderBy: { rankAbsolute: "asc" },
    });
    payload = dbResults.map((r) => ({
      title: r.title,
      address: r.address,
      phone: r.phone,
      domain: r.domain,
      cid: r.cid,
      rating: r.rating,
      votesCount: r.votesCount,
      category: r.category,
    }));
  } else {
    return NextResponse.json({ error: "taskId or results required" }, { status: 400 });
  }

  try {
    const webhookRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "search_results", results: payload }),
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
