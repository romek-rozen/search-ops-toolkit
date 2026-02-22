import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionCredentials, isAdmin } from "@/lib/session";

// GET /api/costs — suma kosztów wszystkich tasków + ostatnie taski z kosztami
export async function GET() {
  const credentials = await getSessionCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userFilter = isAdmin(credentials.login) ? {} : { dfsLogin: credentials.login };

  const [reviewAggregate, bizInfoAggregate] = await Promise.all([
    prisma.reviewTask.aggregate({
      where: userFilter,
      _sum: { cost: true },
      _count: { id: true },
    }),
    prisma.businessInfoTask.aggregate({
      where: userFilter,
      _sum: { cost: true },
      _count: { id: true },
    }),
  ]);

  const recentTasks = await prisma.reviewTask.findMany({
    where: { cost: { gt: 0 }, ...userFilter },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      cost: true,
      depth: true,
      status: true,
      createdAt: true,
      business: { select: { name: true, cid: true } },
    },
  });

  const totalCost =
    (reviewAggregate._sum.cost ?? 0) + (bizInfoAggregate._sum.cost ?? 0);

  return NextResponse.json({
    totalCost,
    totalTasks: reviewAggregate._count.id + bizInfoAggregate._count.id,
    recentTasks,
  });
}
