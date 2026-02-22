import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  dfsLogin: string;
  dfsPassword: string;
  isLoggedIn: boolean;
}

const SESSION_OPTIONS = {
  password: process.env.SESSION_SECRET || "CHANGE_ME_32_CHARS_MINIMUM_SECRET_KEY!!",
  cookieName: "dfs_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
}

// Get credentials from session — returns null if not logged in
export async function getSessionCredentials(): Promise<{ login: string; password: string } | null> {
  const session = await getSession();
  if (!session.isLoggedIn || !session.dfsLogin || !session.dfsPassword) {
    return null;
  }
  return { login: session.dfsLogin, password: session.dfsPassword };
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || "";

export function isAdmin(dfsLogin: string): boolean {
  return !!ADMIN_EMAIL && dfsLogin.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

// Build Prisma where clause filtered by dfsLogin (admin sees everything, shared visible to all)
export function userWhere(dfsLogin: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  if (isAdmin(dfsLogin)) return extra;
  return { ...extra, OR: [{ dfsLogin }, { isShared: true }] };
}

// Check if user can access a resource (owner, admin, or shared)
export function canAccess(resource: { dfsLogin?: string | null; isShared?: boolean }, login: string): boolean {
  return resource.dfsLogin === login || isAdmin(login) || resource.isShared === true;
}
