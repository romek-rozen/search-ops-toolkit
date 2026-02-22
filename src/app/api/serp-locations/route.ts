import { NextRequest, NextResponse } from "next/server";
import { getSerpLocationsForCountry } from "@/lib/locations-cache";
import { getSessionCredentials } from "@/lib/session";
import { serpLocationsSchema, parseBody } from "@/lib/validation";

// POST /api/serp-locations — SERP locations (cities, regions) for a given country
export async function POST(req: NextRequest) {
  try {
    const credentials = await getSessionCredentials();
    if (!credentials) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = parseBody(serpLocationsSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { countryCode } = parsed.data;

    if (!countryCode) {
      return NextResponse.json({ error: "countryCode jest wymagany (np. 'gb', 'us')" }, { status: 400 });
    }

    const locations = await getSerpLocationsForCountry(countryCode, credentials);

    return NextResponse.json({ locations });
  } catch (e) {
    console.error("[serp-locations] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Wystąpił błąd" },
      { status: 500 }
    );
  }
}
