import { DataForSeoCredentials, DfsTaskReadyItem, dfsPost, dfsGet } from "./client";

export interface DfsMapsSearchItem {
  type: string;
  rank_group: number;
  rank_absolute: number;
  domain?: string;
  title?: string;
  url?: string;
  contact_url?: string;
  contributor_url?: string;
  address?: string;
  address_info?: {
    borough?: string | null;
    address?: string | null;
    city?: string | null;
    zip?: string | null;
    region?: string | null;
    country_code?: string | null;
  };
  place_id?: string;
  phone?: string;
  main_image?: string;
  total_photos?: number;
  category?: string;
  additional_categories?: string[];
  price_level?: string;
  rating?: { value: number; votes_count: number; rating_max: number };
  rating_distribution?: Record<string, number>;
  snippet?: string;
  cid?: string;
  latitude?: number;
  longitude?: number;
  is_claimed?: boolean;
  feature_id?: string;
  work_hours?: Record<string, unknown>;
}

interface DfsMapsSearchResult {
  keyword: string;
  se_domain: string;
  location_code: number;
  language_code: string;
  check_url: string;
  items_count: number;
  items: DfsMapsSearchItem[];
}

// Live search — natychmiastowe wyniki
export async function searchMapsLive(
  credentials: DataForSeoCredentials,
  keyword: string,
  locationCode: number,
  languageCode: string,
  depth: number = 100
): Promise<{ items: DfsMapsSearchItem[]; cost: number }> {
  const response = await dfsPost<DfsMapsSearchResult>(
    credentials,
    "/serp/google/maps/live/advanced",
    [{ keyword, location_code: locationCode, language_code: languageCode, depth, device: "desktop", os: "windows" }]
  );

  const task = response.tasks?.[0];
  if (task?.status_code !== 20000) {
    throw new Error(`Maps search failed: ${task?.status_message || "Unknown error"}`);
  }

  const result = task.result?.[0];
  return {
    items: result?.items || [],
    cost: task.cost ?? response.cost ?? 0,
  };
}

// Async task_post — tańsze, wymaga pollingu
export async function postMapsSearchTask(
  credentials: DataForSeoCredentials,
  keyword: string,
  locationCode: number,
  languageCode: string,
  depth: number = 100,
  priority: 1 | 2 = 1
): Promise<{ dfsTaskId: string; cost: number }> {
  const response = await dfsPost<unknown>(
    credentials,
    "/serp/google/maps/task_post",
    [{ keyword, location_code: locationCode, language_code: languageCode, depth, device: "desktop", os: "windows", priority }]
  );

  const task = response.tasks?.[0];
  if (task?.status_code !== 20100) {
    throw new Error(`Maps search task_post failed: ${task?.status_message || "Unknown error"}`);
  }

  return {
    dfsTaskId: task.id,
    cost: task.cost ?? response.cost ?? 0,
  };
}

// Check tasks_ready
export async function checkMapsSearchTasksReady(
  credentials: DataForSeoCredentials
): Promise<DfsTaskReadyItem[]> {
  const response = await dfsGet<DfsTaskReadyItem>(
    credentials,
    "/serp/google/maps/tasks_ready"
  );
  return response.tasks?.[0]?.result || [];
}

// Get task result
export async function getMapsSearchTaskResult(
  credentials: DataForSeoCredentials,
  taskId: string
): Promise<{ items: DfsMapsSearchItem[]; cost: number } | null> {
  const response = await dfsGet<DfsMapsSearchResult>(
    credentials,
    `/serp/google/maps/task_get/advanced/${taskId}`
  );

  const task = response.tasks?.[0];
  if (task?.status_code !== 20000 || !task.result?.length) {
    console.error("[dataforseo] maps search task_get failed:", JSON.stringify(task));
    return null;
  }

  return {
    items: task.result[0]?.items || [],
    cost: task.cost ?? response.cost ?? 0,
  };
}
