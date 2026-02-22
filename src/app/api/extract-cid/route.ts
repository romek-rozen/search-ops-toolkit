import { NextRequest, NextResponse } from "next/server";
import { extractCidFromUrl } from "@/lib/cid-extractor";

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URL jest wymagany" }, { status: 400 });
  }

  const cid = extractCidFromUrl(url);

  if (!cid) {
    return NextResponse.json(
      { error: "Nie udało się wyciągnąć CID z tego URL-a" },
      { status: 400 }
    );
  }

  return NextResponse.json({ cid });
}
