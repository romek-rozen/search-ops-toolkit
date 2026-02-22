import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionCredentials, isAdmin, userWhere } from "@/lib/session";

// List all search tasks (without heavy dfsResponse field)
export async function GET() {
  const credentials = await getSessionCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await prisma.mapsSearchTask.findMany({
    where: userWhere(credentials.login),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      keyword: true,
      locationName: true,
      languageCode: true,
      method: true,
      depth: true,
      status: true,
      resultsCount: true,
      cost: true,
      isShared: true,
      dfsLogin: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ tasks });
}

// Delete a search task by id (cascade deletes MapsSearchResult)
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
    const task = await prisma.mapsSearchTask.findUnique({ where: { id } });
    if (task?.dfsLogin !== credentials.login) {
      return NextResponse.json({ error: "Brak uprawnień" }, { status: 403 });
    }
  }

  await prisma.mapsSearchTask.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
