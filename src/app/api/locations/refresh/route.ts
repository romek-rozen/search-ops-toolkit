import { NextResponse } from "next/server";
import { invalidateAll } from "@/lib/locations-cache";
import { getSessionCredentials } from "@/lib/session";

// POST /api/locations/refresh — clear cache and re-fetch locations from DataForSEO
export async function POST() {
  try {
    const credentials = await getSessionCredentials();
    if (!credentials) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await invalidateAll(credentials, true);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[locations/refresh] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Wystąpił błąd" },
      { status: 500 }
    );
  }
}
