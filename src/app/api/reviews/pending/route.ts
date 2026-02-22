import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionCredentials, isAdmin } from "@/lib/session";

// GET /api/reviews/pending — zwraca pending/ready taski z informacją o firmie
export async function GET() {
  const credentials = await getSessionCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userFilter = isAdmin(credentials.login) ? {} : { dfsLogin: credentials.login };

  const tasks = await prisma.reviewTask.findMany({
    where: { status: { in: ["pending", "ready"] }, ...userFilter },
    orderBy: { createdAt: "desc" },
    include: { business: { select: { cid: true, name: true, mapsUrl: true } } },
  });

  return NextResponse.json({ tasks });
}
