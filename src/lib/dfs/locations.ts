import { DataForSeoCredentials, dfsGet } from "./client";

interface DfsLocationItem {
  location_name: string;
  location_code: number;
  location_type: string;
  country_iso_code: string;
}

interface DfsLanguageItem {
  language_name: string;
  language_code: string;
}

export async function getLocations(
  credentials: DataForSeoCredentials
): Promise<DfsLocationItem[]> {
  const response = await dfsGet<DfsLocationItem>(
    credentials,
    "/business_data/google/locations"
  );
  return response.tasks?.[0]?.result || [];
}

export async function getLanguages(
  credentials: DataForSeoCredentials
): Promise<DfsLanguageItem[]> {
  const response = await dfsGet<DfsLanguageItem>(
    credentials,
    "/business_data/google/languages"
  );
  return response.tasks?.[0]?.result || [];
}

export async function getSerpLocations(
  credentials: DataForSeoCredentials,
  countryCode?: string
): Promise<DfsLocationItem[]> {
  const endpoint = countryCode
    ? `/serp/google/locations/${countryCode}`
    : "/serp/google/locations";
  const response = await dfsGet<DfsLocationItem>(credentials, endpoint);
  return response.tasks?.[0]?.result || [];
}
