import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// POST /api/auth/logout — destroy session
export async function POST() {
  try {
    const session = await getSession();
    session.destroy();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[auth/logout] Error:", e);
    return NextResponse.json({ error: "Wystąpił błąd" }, { status: 500 });
  }
}
