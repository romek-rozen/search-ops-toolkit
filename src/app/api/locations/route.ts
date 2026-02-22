import { NextResponse } from "next/server";
import { getCountries, getCachedLanguages } from "@/lib/locations-cache";
import { getSessionCredentials } from "@/lib/session";

export async function POST() {
  try {
    const credentials = await getSessionCredentials();
    if (!credentials) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [locations, languages] = await Promise.all([
      getCountries(credentials),
      getCachedLanguages(credentials),
    ]);

    return NextResponse.json({ locations, languages });
  } catch (e) {
    console.error("[locations] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Wystąpił błąd" },
      { status: 500 }
    );
  }
}
