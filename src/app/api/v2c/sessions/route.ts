import { NextRequest } from "next/server";
import { db, wallboxSessions } from "@/db";
import { desc, eq } from "drizzle-orm";
import { resolveV2cDeviceId } from "@/lib/v2c-api";

export const dynamic = "force-dynamic";

/** Ricariche salvate su Neon per la wallbox. ?limit=N (default 20). */
export async function GET(request: NextRequest) {
  const deviceId = await resolveV2cDeviceId();
  if (!deviceId) {
    return Response.json({ error: "Nessun deviceId V2C." }, { status: 400 });
  }
  const limit = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get("limit") ?? "20"), 1),
    100
  );
  try {
    const rows = await db
      .select()
      .from(wallboxSessions)
      .where(eq(wallboxSessions.deviceId, deviceId))
      .orderBy(desc(wallboxSessions.startedAt))
      .limit(limit);
    return Response.json({ ok: true, deviceId, sessions: rows });
  } catch (e) {
    return Response.json({ error: "DB error", details: String(e) }, { status: 500 });
  }
}
