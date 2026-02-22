import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionCredentials, isAdmin, userWhere } from "@/lib/session";

interface UnifiedTask {
  id: string;
  type: "review" | "info" | "search";
  dfsTaskId: string | null;
  status: string;
  cost: number | null;
  createdAt: string;
  updatedAt: string;
  businessName: string | null;
  businessCid: string | null;
  keyword: string | null;
  locationName: string | null;
  error: string | null;
  dfsLogin: string | null;
  isShared: boolean;
}

export async function GET(req: NextRequest) {
  const credentials = await getSessionCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");
  const typeFilter = searchParams.get("type");

  const baseWhere = statusFilter ? { status: statusFilter } : {};
  // User isolation: non-admin sees own tasks + shared tasks
  const sharedWhere = userWhere(credentials.login, baseWhere);
  // BusinessInfoTask has no isShared — use simple dfsLogin filter
  const infoWhere = isAdmin(credentials.login) ? baseWhere : { ...baseWhere, dfsLogin: credentials.login };

  // Fetch all 3 task types in parallel
  const [reviewTasks, infoTasks, searchTasks] = await Promise.all([
    !typeFilter || typeFilter === "review"
      ? prisma.reviewTask.findMany({
          where: sharedWhere,
          select: {
            id: true,
            dfsTaskId: true,
            status: true,
            cost: true,
            createdAt: true,
            updatedAt: true,
            keyword: true,
            locationName: true,
            error: true,
            dfsLogin: true,
            isShared: true,
            business: { select: { name: true, cid: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : [],
    !typeFilter || typeFilter === "info"
      ? prisma.businessInfoTask.findMany({
          where: infoWhere,
          select: {
            id: true,
            dfsTaskId: true,
            status: true,
            cost: true,
            createdAt: true,
            updatedAt: true,
            locationName: true,
            error: true,
            dfsLogin: true,
            business: { select: { name: true, cid: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : [],
    !typeFilter || typeFilter === "search"
      ? prisma.mapsSearchTask.findMany({
          where: sharedWhere,
          select: {
            id: true,
            dfsTaskId: true,
            status: true,
            cost: true,
            createdAt: true,
            updatedAt: true,
            keyword: true,
            locationName: true,
            dfsLogin: true,
            isShared: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : [],
  ]);

  // Map to unified format
  const tasks: UnifiedTask[] = [
    ...reviewTasks.map((t) => ({
      id: t.id,
      type: "review" as const,
      dfsTaskId: t.dfsTaskId,
      status: t.status,
      cost: t.cost,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      businessName: t.business.name,
      businessCid: t.business.cid,
      keyword: t.keyword,
      locationName: t.locationName,
      error: t.error,
      dfsLogin: t.dfsLogin,
      isShared: t.isShared,
    })),
    ...infoTasks.map((t) => ({
      id: t.id,
      type: "info" as const,
      dfsTaskId: t.dfsTaskId,
      status: t.status,
      cost: t.cost,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      businessName: t.business.name,
      businessCid: t.business.cid,
      keyword: null,
      locationName: t.locationName,
      error: t.error,
      dfsLogin: t.dfsLogin,
      isShared: false,
    })),
    ...searchTasks.map((t) => ({
      id: t.id,
      type: "search" as const,
      dfsTaskId: t.dfsTaskId,
      status: t.status,
      cost: t.cost,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      businessName: null,
      businessCid: null,
      keyword: t.keyword,
      locationName: t.locationName,
      error: null,
      dfsLogin: t.dfsLogin,
      isShared: t.isShared,
    })),
  ];

  // Sort all by createdAt desc
  tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Summary
  const summary = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending" || t.status === "ready").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    failed: tasks.filter((t) => t.status === "failed").length,
    totalCost: tasks.reduce((sum, t) => sum + (t.cost || 0), 0),
  };

  return NextResponse.json({ tasks, summary });
}
