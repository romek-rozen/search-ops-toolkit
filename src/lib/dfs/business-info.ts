import { DataForSeoCredentials, DfsTaskReadyItem, dfsPost, dfsGet } from "./client";

export interface DfsBusinessInfo {
  title: string;
  description?: string;
  category?: string;
  address?: string;
  address_info?: {
    city?: string | null;
    region?: string | null;
    country_code?: string | null;
    borough?: string | null;
    zip?: string | null;
  };
  phone?: string;
  url?: string;
  domain?: string;
  rating?: { value: number; votes_count: number };
  cid?: string;
}

export interface DfsBusinessInfoTaskPostResult {
  dfsTaskId: string;
  cost: number;
  timeSec: string;
}

// Live endpoint
export async function getBusinessInfo(
  credentials: DataForSeoCredentials,
  cid: string,
  locationName: string,
  languageCode: string
): Promise<DfsBusinessInfo | null> {
  const response = await dfsPost<DfsBusinessInfo>(
    credentials,
    "/business_data/google/my_business_info/live",
    [{ keyword: `cid:${cid}`, location_name: locationName, language_code: languageCode }]
  );

  const task = response.tasks?.[0];
  console.log(`[dfs:biz-info-live] status_code=${task?.status_code} result_count=${task?.result?.length} result[0]_keys=${Object.keys(task?.result?.[0] || {}).join(",")}`);
  console.log(`[dfs:biz-info-live] result[0]=${JSON.stringify(task?.result?.[0])?.slice(0, 800)}`);
  if (task?.status_code !== 20000 || !task.result?.length) {
    console.error("[dataforseo] my_business_info failed:", JSON.stringify(response.tasks?.[0])?.slice(0, 500));
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = task.result[0] as any;
  // Live response may have data nested in items array
  const info: DfsBusinessInfo = raw.title ? raw : raw.items?.[0] ?? raw;
  console.log(`[dfs:biz-info-live] Resolved title="${info.title}" category="${info.category}"`);
  return info;
}

// Async: task_post (priority 1 = standard ~45min, priority 2 = priority ~1min)
export async function postBusinessInfoTask(
  credentials: DataForSeoCredentials,
  cid: string,
  locationName: string,
  languageCode: string,
  priority: 1 | 2 = 1
): Promise<DfsBusinessInfoTaskPostResult> {
  const response = await dfsPost<unknown>(
    credentials,
    "/business_data/google/my_business_info/task_post",
    [{ keyword: `cid:${cid}`, location_name: locationName, language_code: languageCode, priority }]
  );

  const task = response.tasks?.[0];
  if (task?.status_code !== 20100) {
    throw new Error(
      `Nie udało się utworzyć taska business_info: ${task?.status_message || "Unknown error"}`
    );
  }

  console.log(`[dataforseo] Business info task created: ${task.id}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawTask = task as any;

  return {
    dfsTaskId: task.id,
    cost: rawTask.cost ?? response.cost ?? 0,
    timeSec: rawTask.time ?? response.time ?? "0",
  };
}

// Check tasks_ready
export async function checkBusinessInfoTasksReady(
  credentials: DataForSeoCredentials
): Promise<string[]> {
  const response = await dfsGet<DfsTaskReadyItem>(
    credentials,
    "/business_data/google/my_business_info/tasks_ready"
  );

  const readyTasks = response.tasks?.[0]?.result || [];
  return readyTasks.map((t) => t.id);
}

// Get task result
export async function getBusinessInfoTaskResult(
  credentials: DataForSeoCredentials,
  taskId: string
): Promise<{ info: DfsBusinessInfo; cost: number; rawResult: unknown } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await dfsGet<any>(
    credentials,
    `/business_data/google/my_business_info/task_get/${taskId}`
  );

  const task = response.tasks?.[0];
  console.log("[dataforseo] business_info task_get raw result:", JSON.stringify(task?.result?.[0])?.slice(0, 500));

  if (task?.status_code !== 20000 || !task.result?.length) {
    console.error("[dataforseo] business_info task_get failed:", JSON.stringify(task));
    return null;
  }

  const raw = task.result[0];

  // task_get może zwrócić dane bezpośrednio lub w items array
  const info: DfsBusinessInfo = raw.title
    ? raw
    : raw.items?.[0] ?? raw;

  return {
    info,
    cost: task.cost ?? response.cost ?? 0,
    rawResult: raw,
  };
}
