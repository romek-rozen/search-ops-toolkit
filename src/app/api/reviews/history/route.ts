import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionCredentials, isAdmin, userWhere } from "@/lib/session";

// List all review tasks with business name (without heavy dfsResponse field)
export async function GET() {
  const credentials = await getSessionCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await prisma.reviewTask.findMany({
    where: userWhere(credentials.login),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      depth: true,
      cost: true,
      locationName: true,
      languageName: true,
      dfsLogin: true,
      isShared: true,
      createdAt: true,
      business: {
        select: {
          name: true,
          cid: true,
        },
      },
      _count: {
        select: { reviews: true },
      },
    },
  });

  const mapped = tasks.map((t) => ({
    id: t.id,
    businessName: t.business.name,
    businessCid: t.business.cid,
    status: t.status,
    depth: t.depth,
    reviewsCount: t._count.reviews,
    cost: t.cost,
    locationName: t.locationName,
    languageName: t.languageName,
    dfsLogin: t.dfsLogin,
    isShared: t.isShared,
    createdAt: t.createdAt,
  }));

  return NextResponse.json({ tasks: mapped });
}

// Delete a review task by id
export async function DELETE(req: NextRequest) {
  const credentials = await getSessionCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "id jest wymagane" }, { status: 400 });
  }

  if (!isAdmin(credentials.login)) {
    const task = await prisma.reviewTask.findUnique({ where: { id } });
    if (task?.dfsLogin !== credentials.login) {
      return NextResponse.json({ error: "Brak uprawnień" }, { status: 403 });
    }
  }

  await prisma.reviewTask.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
