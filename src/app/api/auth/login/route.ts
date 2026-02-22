import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const DFS_BASE = "https://api.dataforseo.com/v3";

// POST /api/auth/login — validate DFS credentials and create session
export async function POST(req: NextRequest) {
  try {
    const { login, password } = await req.json();

    if (!login || !password) {
      return NextResponse.json({ error: "Login i hasło są wymagane" }, { status: 400 });
    }

    // Validate credentials against DataForSEO API
    const auth = Buffer.from(`${login}:${password}`).toString("base64");
    const res = await fetch(`${DFS_BASE}/appendix/user_data`, {
      method: "GET",
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Nieprawidłowe dane logowania DataForSEO" }, { status: 401 });
    }

    const data = await res.json();
    if (data.status_code !== 20000) {
      return NextResponse.json({ error: "Nieprawidłowe dane logowania DataForSEO" }, { status: 401 });
    }

    // Save to session
    const session = await getSession();
    session.dfsLogin = login;
    session.dfsPassword = password;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({ ok: true, login });
  } catch (e) {
    console.error("[auth/login] Error:", e);
    return NextResponse.json({ error: "Wystąpił błąd podczas logowania" }, { status: 500 });
  }
}
