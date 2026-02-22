import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateCsv, generateXlsx } from "@/lib/export";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cid = searchParams.get("cid");
  const format = searchParams.get("format") || "csv";

  if (!cid) {
    return NextResponse.json({ error: "CID jest wymagany" }, { status: 400 });
  }

  const business = await prisma.business.findUnique({
    where: { cid },
    include: {
      reviews: { orderBy: { publishedAt: "desc" } },
    },
  });

  if (!business) {
    return NextResponse.json({ error: "Firma nie znaleziona" }, { status: 404 });
  }

  const rows = business.reviews.map((r) => ({
    author: r.authorName,
    rating: r.rating,
    date: r.publishedAt?.toISOString().split("T")[0] || "",
    text: r.text || "",
    ownerResponse: r.ownerResponse || "",
  }));

  const safeName = business.name.replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s-]/g, "").trim();

  if (format === "xlsx") {
    const buffer = generateXlsx(rows);
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeName} - opinie.xlsx"`,
      },
    });
  }

  const csv = generateCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName} - opinie.csv"`,
    },
  });
}
