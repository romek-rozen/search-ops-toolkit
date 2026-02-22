import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionCredentials, isAdmin } from "@/lib/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cid: string }> }
) {
  const credentials = await getSessionCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { cid } = await params;
  const { login } = credentials;
  const admin = isAdmin(login);

  const business = await prisma.business.findUnique({
    where: { cid },
    include: { _count: { select: { reviews: true } } },
  });

  if (!business) {
    return NextResponse.json({ error: "Nie znaleziono firmy" }, { status: 404 });
  }

  // Verify ownership — non-admins can see own businesses or those with shared tasks
  if (!admin && business.dfsLogin !== login) {
    // Check if user has access through shared tasks
    const sharedTaskCount = await prisma.reviewTask.count({
      where: { businessId: business.id, isShared: true },
    });
    const sharedSearchCount = await prisma.mapsSearchResult.count({
      where: { businessCid: cid, task: { isShared: true } },
    });
    if (sharedTaskCount === 0 && sharedSearchCount === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const taskOwnerFilter = admin ? {} : { OR: [{ dfsLogin: login }, { isShared: true }] };

  const [reviewTasks, infoTasks] = await Promise.all([
    prisma.reviewTask.findMany({
      where: { businessId: business.id, ...taskOwnerFilter },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        depth: true,
        cost: true,
        timeSec: true,
        locationName: true,
        languageName: true,
        error: true,
        createdAt: true,
        _count: { select: { reviews: true } },
      },
    }),
    prisma.businessInfoTask.findMany({
      where: { businessId: business.id, ...taskOwnerFilter },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        cost: true,
        timeSec: true,
        locationName: true,
        languageCode: true,
        error: true,
        createdAt: true,
      },
    }),
  ]);

  // Fetch additional categories from linked search results
  const searchResult = await prisma.mapsSearchResult.findFirst({
    where: { cid },
    select: { additionalCategories: true },
    orderBy: { createdAt: "desc" },
  });
  const additionalCategories = searchResult?.additionalCategories ?? [];

  const reviewCost = reviewTasks.reduce((s, t) => s + (t.cost ?? 0), 0);
  const infoCost = infoTasks.reduce((s, t) => s + (t.cost ?? 0), 0);

  return NextResponse.json({
    business,
    additionalCategories,
    reviewTasks,
    infoTasks,
    costs: { reviewTasks: reviewCost, infoTasks: infoCost, total: reviewCost + infoCost },
  });
}
