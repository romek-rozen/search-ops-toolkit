import { z } from "zod";

// Reusable primitives
const cid = z.string().min(1, "CID jest wymagany").regex(/^\d+$/, "CID musi być liczbą");
const depth = z.number().int().min(10).max(4490).default(100);
const sortBy = z.enum(["newest", "highest_rating", "lowest_rating", "relevant"]).default("newest");
const url = z.string().url("Nieprawidłowy URL");
const taskId = z.string().min(1, "taskId jest wymagany");

// POST /api/reviews
export const reviewsPostSchema = z.object({
  cid,
  refresh: z.boolean().optional(),
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(1000).default(100),
  depth,
  sortBy,
  languageName: z.string().optional(),
  locationName: z.string().optional(),
});

// POST /api/reviews/status
export const reviewsStatusSchema = z.object({
  taskId,
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(1000).default(100),
});

// POST /api/reviews/batch
export const reviewsBatchSchema = z.object({
  items: z.array(z.object({
    cid,
    name: z.string().optional(),
    address: z.string().optional(),
    mapsUrl: z.string().optional(),
  })).min(1).max(100),
  languageName: z.string().optional(),
  locationName: z.string().optional(),
  depth,
  sortBy,
});

// POST /api/reviews/batch/status
export const reviewsBatchStatusSchema = z.object({
  taskIds: z.array(taskId).min(1),
});

// POST /api/search
export const searchPostSchema = z.object({
  keyword: z.string().min(1, "Keyword jest wymagany"),
  locationCode: z.number().int().positive(),
  locationName: z.string().optional(),
  languageCode: z.string().min(1),
  depth,
  method: z.enum(["live", "standard", "priority"]).default("live"),
  refresh: z.boolean().optional(),
});

// POST /api/search/status
export const searchStatusSchema = z.object({
  taskId,
});

// POST /api/business-info
export const businessInfoSchema = z.object({
  cid,
  refresh: z.boolean().optional(),
  cacheOnly: z.boolean().optional(),
  mapsUrl: z.string().optional(),
  locationName: z.string().optional(),
  languageCode: z.string().optional(),
  method: z.enum(["live", "standard", "priority"]).default("standard"),
});

// POST /api/business-info/task/status
export const businessInfoTaskStatusSchema = z.object({
  dfsTaskId: z.string().min(1),
});

// POST /api/locations
export const locationsSchema = z.object({}).passthrough();

// POST /api/locations/refresh
export const locationsRefreshSchema = z.object({}).passthrough();

// POST /api/serp-locations
export const serpLocationsSchema = z.object({
  countryCode: z.string().min(1).optional(),
});

// POST /api/extract-cid
export const extractCidSchema = z.object({
  url: z.string().min(1, "URL jest wymagany"),
});

// POST /api/search/webhook
export const searchWebhookSchema = z.object({
  taskId,
  webhookUrl: url,
});

// POST /api/reviews/webhook
export const reviewsWebhookSchema = z.object({
  taskId,
  webhookUrl: url,
});

// POST /api/business-info/history
export const businessInfoHistorySchema = z.object({
  cid,
});

// PATCH /api/share
export const shareToggleSchema = z.object({
  taskId,
  taskType: z.enum(["review", "mapsSearch"]),
  isShared: z.boolean(),
});

// POST /api/tasks/retry
export const taskRetrySchema = z.object({
  taskId,
  type: z.enum(["review", "info", "search"]),
});

// Helper: parse and return 400 on failure
export function parseBody<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
    return { success: false, error: messages };
  }
  return { success: true, data: result.data };
}
