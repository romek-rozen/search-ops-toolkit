import { NextRequest, NextResponse } from "next/server";
import { getSessionCredentials } from "@/lib/session";
import { taskRetrySchema, parseBody } from "@/lib/validation";
import { retryReviewTask, retrySearchTask, retryInfoTask } from "@/lib/task-retry";

// POST /api/tasks/retry — force-check a single pending task and fetch results if ready
export async function POST(req: NextRequest) {
  try {
    const credentials = await getSessionCredentials();
    if (!credentials) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = parseBody(taskRetrySchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { taskId, type } = parsed.data;
    console.log(`[tasks/retry] type=${type} taskId=${taskId}`);

    // Force mode: bypass grace period, try task_get immediately
    let result;
    if (type === "review") {
      result = await retryReviewTask(taskId, credentials, undefined, true);
    } else if (type === "search") {
      result = await retrySearchTask(taskId, credentials, undefined, true);
    } else {
      result = await retryInfoTask(taskId, credentials, undefined, true);
    }

    console.log(`[tasks/retry] type=${type} taskId=${taskId} → ${result.taskStatus}${result.error ? ` error=${result.error}` : ""}`);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[tasks/retry] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Wystąpił błąd" },
      { status: 500 }
    );
  }
}
