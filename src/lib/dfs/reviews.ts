import { DataForSeoCredentials, DfsTaskReadyItem, dfsPost, dfsGet } from "./client";

export interface DfsReview {
  review_text?: string;
  original_review_text?: string;
  time_ago?: string;
  timestamp?: string;
  rating?: { value: number };
  review_id?: string;
  profile_name?: string;
  profile_image_url?: string;
  owner_answer?: string;
  owner_time_ago?: string;
  owner_timestamp?: string;
}

export interface DfsReviewsResult {
  cid: string;
  reviews_count: number;
  rating: { value: number; votes_count: number };
  items_count: number;
  items: DfsReview[];
}

export interface DfsTaskPostResult {
  dfsTaskId: string;
  cost: number;
  timeSec: string;
  dfsStatusCode: number;
  data: Record<string, unknown>;
  fullResponse: Record<string, unknown>;
}

export interface DfsTaskGetResult {
  reviews: DfsReviewsResult;
  cost: number;
}

export async function postReviewsTask(
  credentials: DataForSeoCredentials,
  cid: string,
  depth: number = 100,
  sortBy: string = "newest",
  languageName: string = "English",
  locationName: string = "Poland"
): Promise<DfsTaskPostResult> {
  const response = await dfsPost<unknown>(
    credentials,
    "/business_data/google/reviews/task_post",
    [{ cid, depth, sort_by: sortBy, language_name: languageName, location_name: locationName }]
  );

  const task = response.tasks?.[0];
  if (task?.status_code !== 20100) {
    throw new Error(
      `Nie udało się utworzyć taska reviews: ${task?.status_message || "Unknown error"}`
    );
  }

  console.log(`[dataforseo] Reviews task created: ${task.id}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawTask = task as any;

  return {
    dfsTaskId: task.id,
    cost: rawTask.cost ?? response.cost ?? 0,
    timeSec: rawTask.time ?? response.time ?? "",
    dfsStatusCode: task.status_code,
    data: rawTask.data ?? {},
    fullResponse: rawTask,
  };
}

export async function checkTasksReady(
  credentials: DataForSeoCredentials
): Promise<string[]> {
  const response = await dfsGet<DfsTaskReadyItem>(
    credentials,
    "/business_data/google/reviews/tasks_ready"
  );

  const readyTasks = response.tasks?.[0]?.result || [];
  return readyTasks.map((t) => t.id);
}

export async function getTaskResult(
  credentials: DataForSeoCredentials,
  taskId: string
): Promise<DfsTaskGetResult | null> {
  const response = await dfsGet<DfsReviewsResult>(
    credentials,
    `/business_data/google/reviews/task_get/${taskId}`
  );

  const task = response.tasks?.[0];
  if (task?.status_code !== 20000 || !task.result?.length) {
    console.error("[dataforseo] task_get failed:", JSON.stringify(task));
    return null;
  }

  return {
    reviews: task.result[0],
    cost: task.cost ?? response.cost ?? 0,
  };
}
