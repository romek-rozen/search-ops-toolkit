// Helper for DataForSEO postback (callback) URLs and IP allowlist

// DataForSEO callback server IPs — only these IPs should send postback requests
export const DFS_CALLBACK_IPS = new Set([
  "144.76.154.130",
  "144.76.153.113",
  "144.76.153.106",
  "94.130.155.89",
  "178.63.193.217",
  "94.130.93.29",
]);

type TaskType = "reviews" | "search" | "business-info";

/**
 * Build postback URL for DataForSEO task_post payload.
 * Returns undefined if CALLBACK_BASE_URL is not configured (polling-only mode).
 */
export function buildPostbackUrl(taskType: TaskType): string | undefined {
  const baseUrl = process.env.CALLBACK_BASE_URL;
  if (!baseUrl) return undefined;

  return `${baseUrl}/api/callback/postback?tag=${taskType}`;
}
