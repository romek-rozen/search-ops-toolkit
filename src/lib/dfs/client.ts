export interface DataForSeoCredentials {
  login: string;
  password: string;
}

export interface DfsLocationLanguage {
  locationName: string;
  languageName: string;
  languageCode: string;
}

export interface DfsResponse<T> {
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  tasks: Array<{
    id: string;
    status_code: number;
    status_message: string;
    time: string;
    cost: number;
    result: T[];
  }>;
}

export interface DfsTaskReadyItem {
  id: string;
  endpoint_advanced: string;
  endpoint_html: string;
}

const DFS_BASE = "https://api.dataforseo.com/v3";

function makeAuth(credentials: DataForSeoCredentials): string {
  return Buffer.from(`${credentials.login}:${credentials.password}`).toString(
    "base64"
  );
}

function authHeaders(credentials: DataForSeoCredentials) {
  return {
    Authorization: `Basic ${makeAuth(credentials)}`,
    "Content-Type": "application/json",
  };
}

export async function dfsPost<T>(
  credentials: DataForSeoCredentials,
  endpoint: string,
  body: unknown[]
): Promise<DfsResponse<T>> {
  console.log(`[dfs] POST ${endpoint}`);
  const start = Date.now();
  const res = await fetch(`${DFS_BASE}${endpoint}`, {
    method: "POST",
    headers: authHeaders(credentials),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[dfs] POST ${endpoint} → ${res.status} (${Date.now() - start}ms): ${text.slice(0, 500)}`);
    throw new Error(`DataForSEO error ${res.status}: ${text}`);
  }

  const data: DfsResponse<T> = await res.json();
  const taskCount = data.tasks?.length ?? 0;
  const taskStatus = data.tasks?.[0]?.status_code;
  console.log(`[dfs] POST ${endpoint} → ${res.status} (${Date.now() - start}ms) tasks=${taskCount} taskStatus=${taskStatus} cost=$${data.cost ?? 0}`);
  return data;
}

export async function dfsGet<T>(
  credentials: DataForSeoCredentials,
  endpoint: string
): Promise<DfsResponse<T>> {
  console.log(`[dfs] GET ${endpoint}`);
  const start = Date.now();
  const res = await fetch(`${DFS_BASE}${endpoint}`, {
    method: "GET",
    headers: authHeaders(credentials),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[dfs] GET ${endpoint} → ${res.status} (${Date.now() - start}ms): ${text.slice(0, 500)}`);
    throw new Error(`DataForSEO error ${res.status}: ${text}`);
  }

  const data: DfsResponse<T> = await res.json();
  const taskCount = data.tasks?.length ?? 0;
  const resultCount = data.tasks?.[0]?.result?.length ?? 0;
  const taskStatus = data.tasks?.[0]?.status_code;
  console.log(`[dfs] GET ${endpoint} → ${res.status} (${Date.now() - start}ms) tasks=${taskCount} results=${resultCount} taskStatus=${taskStatus} cost=$${data.cost ?? 0}`);
  return data;
}
