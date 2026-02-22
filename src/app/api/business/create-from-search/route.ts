import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionCredentials } from "@/lib/session";
import { z } from "zod";
import { parseBody } from "@/lib/validation";

const schema = z.object({
  cid: z.string().min(1).optional(),
  cids: z.array(z.string().min(1)).min(1).max(100).optional(),
}).refine(d => d.cid || d.cids, { message: "cid lub cids jest wymagany" });

// Create or return Business from existing MapsSearchResult data (no DataForSEO API call)
export async function POST(req: NextRequest) {
  const creds = await getSessionCredentials();
  if (!creds) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = parseBody(schema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const cidList = parsed.data.cids ?? [parsed.data.cid!];

  // Find which businesses already exist
  const existing = await prisma.business.findMany({
    where: { cid: { in: cidList } },
  });
  const existingCids = new Set(existing.map(b => b.cid));
  const missingCids = cidList.filter(c => !existingCids.has(c));

  if (missingCids.length === 0) {
    return NextResponse.json({ businesses: existing, created: 0 });
  }

  // Find MapsSearchResults for missing CIDs
  const searchResults = await prisma.mapsSearchResult.findMany({
    where: { cid: { in: missingCids } },
    orderBy: { createdAt: "desc" },
    distinct: ["cid"],
  });

  const srByCid = new Map(searchResults.map(sr => [sr.cid!, sr]));

  // Create businesses from search results
  const toCreate = missingCids
    .filter(cid => srByCid.has(cid))
    .map(cid => {
      const sr = srByCid.get(cid)!;
      return {
        cid,
        name: sr.title,
        address: sr.address,
        city: sr.city,
        country: sr.country,
        phone: sr.phone,
        website: sr.domain || sr.url,
        category: sr.category,
        rating: sr.rating,
        totalReviews: sr.votesCount,
        mapsUrl: `https://www.google.com/maps?cid=${cid}`,
        dfsLogin: creds.login,
      };
    });

  let created = 0;
  if (toCreate.length > 0) {
    const result = await prisma.business.createMany({
      data: toCreate,
      skipDuplicates: true,
    });
    created = result.count;
  }

  // Return all businesses (existing + newly created)
  const allBusinesses = await prisma.business.findMany({
    where: { cid: { in: cidList } },
  });

  return NextResponse.json({ businesses: allBusinesses, created });
}
