import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionCredentials, isAdmin } from "@/lib/session";

// GET /api/businesses — list all businesses from DB
export async function GET() {
  const credentials = await getSessionCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userFilter = isAdmin(credentials.login) ? {} : { dfsLogin: credentials.login };

  const businesses = await prisma.business.findMany({
    where: userFilter,
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { reviews: true, tasks: true } },
    },
  });

  return NextResponse.json({ businesses });
}

export async function DELETE(req: NextRequest) {
  const credentials = await getSessionCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "id jest wymagane" }, { status: 400 });
  }

  // Verify ownership
  if (!isAdmin(credentials.login)) {
    const business = await prisma.business.findUnique({ where: { id } });
    if (business?.dfsLogin !== credentials.login) {
      return NextResponse.json({ error: "Brak uprawnień" }, { status: 403 });
    }
  }

  await prisma.business.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
