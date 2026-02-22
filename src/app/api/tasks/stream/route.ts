import { NextRequest, NextResponse } from "next/server";
import { getSessionCredentials } from "@/lib/session";
import { taskEvents, TaskCompleteEvent } from "@/lib/task-events";

// GET /api/tasks/stream?taskIds=id1,id2 — SSE stream for real-time task completion
export async function GET(req: NextRequest) {
  const credentials = await getSessionCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const taskIds = req.nextUrl.searchParams.get("taskIds")?.split(",").filter(Boolean) || [];

  if (taskIds.length === 0) {
    return NextResponse.json({ error: "taskIds required" }, { status: 400 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Stream already closed
        }
      };

      const onComplete = (event: TaskCompleteEvent) => {
        if (taskIds.includes(event.taskId)) {
          send(JSON.stringify(event));
        }
      };

      taskEvents.on("task:complete", onComplete);

      // Keepalive ping every 30s to prevent connection timeout
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(ping);
        }
      }, 30000);

      // Cleanup on client disconnect
      req.signal.addEventListener("abort", () => {
        taskEvents.off("task:complete", onComplete);
        clearInterval(ping);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
