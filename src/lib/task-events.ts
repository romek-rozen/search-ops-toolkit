import { EventEmitter } from "events";

// Singleton EventEmitter for real-time task completion notifications (SSE)
const globalForEvents = globalThis as unknown as { taskEvents: EventEmitter };
export const taskEvents = globalForEvents.taskEvents || new EventEmitter();
globalForEvents.taskEvents = taskEvents;
taskEvents.setMaxListeners(100);

export interface TaskCompleteEvent {
  taskId: string;
  dfsTaskId: string;
  tag: "reviews" | "search" | "business-info";
  status: "completed" | "failed";
  error?: string;
}
