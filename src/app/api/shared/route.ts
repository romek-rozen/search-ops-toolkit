import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionCredentials } from "@/lib/session";

// GET /api/shared — list shared tasks
// Query params:
//   owner: "others" (default) | "mine" | "all"
//   type: "all" (default) | "search" | "review"
export async function GET(req: NextRequest) {
  const credentials = await getSessionCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { login } = credentials;
  const { searchParams } = req.nextUrl;
  const owner = searchParams.get("owner") || "others";
  const type = searchParams.get("type") || "all";

  // Build dfsLogin filter based on owner param
  const ownerFilter =
    owner === "mine" ? { dfsLogin: login } :
    owner === "others" ? { NOT: { dfsLogin: login } } :
    {}; // "all"

  const baseWhere = { isShared: true, ...ownerFilter };

  const [reviewTasks, searchTasks] = await Promise.all([
    type === "search" ? Promise.resolve([]) :
    prisma.reviewTask.findMany({
      where: baseWhere,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        depth: true,
        cost: true,
        locationName: true,
        languageName: true,
        dfsLogin: true,
        createdAt: true,
        business: { select: { name: true, cid: true } },
        _count: { select: { reviews: true } },
      },
    }),
    type === "review" ? Promise.resolve([]) :
    prisma.mapsSearchTask.findMany({
      where: baseWhere,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        keyword: true,
        locationName: true,
        method: true,
        depth: true,
        status: true,
        resultsCount: true,
        cost: true,
        dfsLogin: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({ reviewTasks, searchTasks });
}
