import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBusinessInfo, postBusinessInfoTask } from "@/lib/dataforseo";
import { getSessionCredentials } from "@/lib/session";
import { businessInfoSchema, parseBody } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const credentials = await getSessionCredentials();
    if (!credentials) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = parseBody(businessInfoSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { cid, refresh, mapsUrl, locationName, languageCode, cacheOnly, method } = parsed.data;
    const loc = locationName || "Poland";
    const lang = languageCode || "pl";

    // Sprawdź cache w DB
    if (!refresh) {
      const cached = await prisma.business.findUnique({ where: { cid } });
      if (cached && cached.name !== "Nieznana firma") {
        return NextResponse.json({ business: cached, fromCache: true });
      }
      if (cacheOnly) {
        if (cached) {
          return NextResponse.json({ business: cached, fromCache: true });
        }
        return NextResponse.json({ error: "Firma nie znaleziona w cache" }, { status: 404 });
      }
    }

    // Only try live endpoint when method === "live"
    let info = null;
    if (method === "live") {
      try {
        info = await getBusinessInfo(credentials, cid, loc, lang);
      } catch (liveErr) {
        console.error("[business-info] Live endpoint failed, falling back to async:", liveErr);
      }
    }

    if (info?.title) {
      // Live zadziałał — zapisz do DB + historia nazw
      const business = await prisma.business.upsert({
        where: { cid },
        create: {
          cid,
          name: info.title,
          address: info.address,
          city: info.address_info?.city ?? null,
          country: info.address_info?.country_code ?? null,
          phone: info.phone,
          website: info.domain || info.url,
          category: info.category,
          rating: info.rating?.value,
          totalReviews: info.rating?.votes_count,
          mapsUrl: mapsUrl || null,
          dfsLogin: credentials.login,
        },
        update: {
          name: info.title,
          address: info.address,
          city: info.address_info?.city ?? null,
          country: info.address_info?.country_code ?? null,
          phone: info.phone,
          website: info.domain || info.url,
          category: info.category,
          rating: info.rating?.value,
          totalReviews: info.rating?.votes_count,
          mapsUrl: mapsUrl || undefined,
        },
      });

      await prisma.businessNameHistory.create({
        data: { businessId: business.id, name: info.title, source: "live" },
      });

      await prisma.businessDataHistory.create({
        data: {
          businessId: business.id,
          name: info.title,
          address: info.address,
          phone: info.phone,
          website: info.domain || info.url,
          category: info.category,
          rating: info.rating?.value,
          totalReviews: info.rating?.votes_count,
          source: "live",
        },
      });

      return NextResponse.json({ business, fromCache: false });
    }

    // Live nie zwrócił danych — utwórz placeholder i uruchom async task
    const placeholder = await prisma.business.upsert({
      where: { cid },
      create: { cid, name: "Nieznana firma", mapsUrl: mapsUrl || null, dfsLogin: credentials.login },
      update: { mapsUrl: mapsUrl || undefined },
    });

    // Sprawdź czy już jest pending task
    const existingTask = await prisma.businessInfoTask.findFirst({
      where: { businessId: placeholder.id, status: "pending" },
    });

    if (existingTask) {
      return NextResponse.json({
        business: placeholder,
        fromCache: false,
        asyncTaskId: existingTask.dfsTaskId,
        asyncDbTaskId: existingTask.id,
      });
    }

    // Utwórz nowy async task
    console.log(`[business-info] Live returned null for CID ${cid}, creating async task...`);
    try {
      const priority = method === "priority" ? 2 : 1;
      const taskResult = await postBusinessInfoTask(credentials, cid, loc, lang, priority);
      console.log(`[business-info] Async task created: ${taskResult.dfsTaskId}`);

      const dbTask = await prisma.businessInfoTask.create({
        data: {
          dfsTaskId: taskResult.dfsTaskId,
          businessId: placeholder.id,
          status: "pending",
          cost: taskResult.cost,
          timeSec: taskResult.timeSec,
          locationName: loc,
          languageCode: lang,
          dfsLogin: credentials.login,
        },
      });

      return NextResponse.json({
        business: placeholder,
        fromCache: false,
        asyncTaskId: taskResult.dfsTaskId,
        asyncDbTaskId: dbTask.id,
      });
    } catch (taskError) {
      console.error("[business-info] Async task creation failed:", taskError);
      return NextResponse.json({ business: placeholder, fromCache: false });
    }
  } catch (e) {
    console.error("[business-info] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Wystąpił błąd" },
      { status: 500 }
    );
  }
}
