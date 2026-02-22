import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/session";

// GET /api/auth/me — session status
export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.dfsLogin) {
      return NextResponse.json({ isLoggedIn: false });
    }
    return NextResponse.json({
      isLoggedIn: true,
      login: session.dfsLogin,
      isAdmin: isAdmin(session.dfsLogin),
    });
  } catch {
    return NextResponse.json({ isLoggedIn: false });
  }
}
