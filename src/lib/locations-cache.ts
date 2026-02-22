import { prisma } from "@/lib/db";
import { getLocations, getLanguages, getSerpLocations } from "@/lib/dataforseo";

// Types matching what the API routes return
export interface CountryOption {
  name: string;
  code: number;
  countryCode: string;
}

export interface LanguageOption {
  name: string;
  code: string;
}

export interface SerpLocationOption {
  name: string;
  code: number;
  countryCode: string;
  locationType: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface LocationsCache {
  countries: CacheEntry<CountryOption[]> | null;
  languages: CacheEntry<LanguageOption[]> | null;
  serpLocations: Map<string, CacheEntry<SerpLocationOption[]>>;
}

// 30 days TTL — locations data is practically static
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

const globalForCache = globalThis as unknown as { locationsCache: LocationsCache };

if (!globalForCache.locationsCache) {
  globalForCache.locationsCache = {
    countries: null,
    languages: null,
    serpLocations: new Map(),
  };
}

const cache = globalForCache.locationsCache;

function isValid<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
  return entry !== null && Date.now() - entry.timestamp < TTL_MS;
}

/**
 * Get countries list. Checks in-memory → DB → DataForSEO API.
 * Credentials only needed if data not in DB yet.
 */
export async function getCountries(
  credentials?: { login: string; password: string }
): Promise<CountryOption[]> {
  if (isValid(cache.countries)) {
    return cache.countries.data;
  }

  // Try DB
  const dbLocations = await prisma.dfsLocation.findMany({ orderBy: { name: "asc" } });
  if (dbLocations.length > 0) {
    const data = dbLocations.map((l) => ({
      name: l.name,
      code: l.id,
      countryCode: l.countryCode,
    }));
    cache.countries = { data, timestamp: Date.now() };
    return data;
  }

  // Fetch from DataForSEO
  if (!credentials?.login || !credentials?.password) {
    throw new Error("Dane API DataForSEO są wymagane do pierwszego pobrania lokalizacji");
  }

  const dfsLocations = await getLocations(credentials);
  const countries = dfsLocations.filter((l) => l.location_type === "Country");

  // Save to DB
  await prisma.$transaction([
    prisma.dfsLocation.deleteMany(),
    ...countries.map((l) =>
      prisma.dfsLocation.create({
        data: {
          id: l.location_code,
          name: l.location_name,
          countryCode: l.country_iso_code,
          locationType: l.location_type,
        },
      })
    ),
  ]);

  const data = countries
    .map((l) => ({
      name: l.location_name,
      code: l.location_code,
      countryCode: l.country_iso_code,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  cache.countries = { data, timestamp: Date.now() };
  console.log(`[locations-cache] Cached ${data.length} countries`);
  return data;
}

/**
 * Get languages list. Checks in-memory → DB → DataForSEO API.
 */
export async function getCachedLanguages(
  credentials?: { login: string; password: string }
): Promise<LanguageOption[]> {
  if (isValid(cache.languages)) {
    return cache.languages.data;
  }

  // Try DB
  const dbLanguages = await prisma.dfsLanguage.findMany({ orderBy: { name: "asc" } });
  if (dbLanguages.length > 0) {
    const data = dbLanguages.map((l) => ({
      name: l.name,
      code: l.code,
    }));
    cache.languages = { data, timestamp: Date.now() };
    return data;
  }

  // Fetch from DataForSEO
  if (!credentials?.login || !credentials?.password) {
    throw new Error("Dane API DataForSEO są wymagane do pierwszego pobrania języków");
  }

  const dfsLanguages = await getLanguages(credentials);

  await prisma.$transaction([
    prisma.dfsLanguage.deleteMany(),
    ...dfsLanguages.map((l) =>
      prisma.dfsLanguage.create({
        data: {
          code: l.language_code,
          name: l.language_name,
        },
      })
    ),
  ]);

  const data = dfsLanguages.map((l) => ({
    name: l.language_name,
    code: l.language_code,
  }));

  cache.languages = { data, timestamp: Date.now() };
  console.log(`[locations-cache] Cached ${data.length} languages`);
  return data;
}

/**
 * Get SERP locations for a country. Checks in-memory → DB → DataForSEO API.
 */
export async function getSerpLocationsForCountry(
  countryCode: string,
  credentials?: { login: string; password: string }
): Promise<SerpLocationOption[]> {
  const code = countryCode.toUpperCase();

  const cached = cache.serpLocations.get(code) ?? null;
  if (isValid(cached)) {
    return cached.data;
  }

  // Try DB
  const dbLocations = await prisma.dfsSerpLocation.findMany({
    where: { countryCode: code },
    orderBy: { name: "asc" },
  });

  if (dbLocations.length > 0) {
    const data = dbLocations.map((l) => ({
      name: l.name,
      code: l.id,
      countryCode: l.countryCode,
      locationType: l.locationType,
    }));
    cache.serpLocations.set(code, { data, timestamp: Date.now() });
    return data;
  }

  // Fetch from DataForSEO
  if (!credentials?.login || !credentials?.password) {
    throw new Error("Dane API DataForSEO są wymagane do pierwszego pobrania lokalizacji");
  }

  const dfsLocations = await getSerpLocations(credentials, countryCode.toLowerCase());

  // Save to DB
  for (const loc of dfsLocations) {
    await prisma.dfsSerpLocation.upsert({
      where: { id: loc.location_code },
      update: {
        name: loc.location_name,
        countryCode: loc.country_iso_code,
        locationType: loc.location_type,
      },
      create: {
        id: loc.location_code,
        name: loc.location_name,
        countryCode: loc.country_iso_code,
        locationType: loc.location_type,
      },
    });
  }

  const data = dfsLocations
    .map((l) => ({
      name: l.location_name,
      code: l.location_code,
      countryCode: l.country_iso_code,
      locationType: l.location_type,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  cache.serpLocations.set(code, { data, timestamp: Date.now() });
  console.log(`[locations-cache] Cached ${data.length} SERP locations for ${code}`);
  return data;
}

/**
 * Invalidate all in-memory caches. Optionally clear DB and re-fetch.
 */
export async function invalidateAll(
  credentials?: { login: string; password: string },
  refetchFromApi = false
) {
  // Clear in-memory
  cache.countries = null;
  cache.languages = null;
  cache.serpLocations.clear();

  if (refetchFromApi && credentials?.login && credentials?.password) {
    // Clear DB
    await prisma.$transaction([
      prisma.dfsLocation.deleteMany(),
      prisma.dfsLanguage.deleteMany(),
      prisma.dfsSerpLocation.deleteMany(),
    ]);

    // Re-fetch countries and languages (SERP locations fetched on demand per country)
    await Promise.all([
      getCountries(credentials),
      getCachedLanguages(credentials),
    ]);
  }
}
