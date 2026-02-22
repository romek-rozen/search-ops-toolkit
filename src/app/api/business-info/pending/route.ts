import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionCredentials, isAdmin } from "@/lib/session";

// GET /api/business-info/pending — zwraca pending business info taski
export async function GET() {
  const credentials = await getSessionCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userFilter = isAdmin(credentials.login) ? {} : { dfsLogin: credentials.login };

  const tasks = await prisma.businessInfoTask.findMany({
    where: { status: "pending", ...userFilter },
    orderBy: { createdAt: "desc" },
    include: { business: { select: { cid: true, name: true } } },
  });

  return NextResponse.json({ tasks });
}
