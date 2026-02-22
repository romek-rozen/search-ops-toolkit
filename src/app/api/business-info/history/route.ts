import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/business-info/history — historia sprawdzeń business info dla danego CID
export async function POST(req: NextRequest) {
  const { cid } = await req.json();

  if (!cid) {
    return NextResponse.json({ error: "CID jest wymagany" }, { status: 400 });
  }

  const business = await prisma.business.findUnique({
    where: { cid },
    select: { id: true },
  });

  if (!business) {
    return NextResponse.json({ tasks: [], nameHistory: [] });
  }

  const [tasks, nameHistory, dataHistory] = await Promise.all([
    prisma.businessInfoTask.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        dfsTaskId: true,
        status: true,
        cost: true,
        locationName: true,
        languageCode: true,
        error: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.businessNameHistory.findMany({
      where: { businessId: business.id },
      orderBy: { recordedAt: "desc" },
      select: {
        id: true,
        name: true,
        source: true,
        recordedAt: true,
      },
    }),
    prisma.businessDataHistory.findMany({
      where: { businessId: business.id },
      orderBy: { recordedAt: "desc" },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        website: true,
        category: true,
        rating: true,
        totalReviews: true,
        source: true,
        recordedAt: true,
      },
    }),
  ]);

  return NextResponse.json({ tasks, nameHistory, dataHistory });
}
