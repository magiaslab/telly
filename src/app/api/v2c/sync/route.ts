import { NextRequest } from "next/server";
import { db, wallboxSessions } from "@/db";
import {
  getV2cDeviceStatistics,
  resolveV2cDeviceId,
  v2cStatToSessionRow,
} from "@/lib/v2c-api";

export const dynamic = "force-dynamic";

/**
 * Sincronizza le ultime ricariche della wallbox V2C verso Neon (upsert su deviceId+idCharge).
 * Utile da chiamare manualmente o via cron. Filtri opzionali: ?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function GET(request: NextRequest) {
  const deviceId = await resolveV2cDeviceId();
  if (!deviceId) {
    return Response.json(
      { error: "Nessun deviceId V2C: imposta V2C_API_KEY (e opzionalmente V2C_DEVICE_ID)." },
      { status: 400 }
    );
  }

  const from = request.nextUrl.searchParams.get("from") ?? undefined;
  const to = request.nextUrl.searchParams.get("to") ?? undefined;

  let stats;
  try {
    stats = await getV2cDeviceStatistics(deviceId, from, to);
  } catch (e) {
    return Response.json({ error: "V2C statistics failed", details: String(e) }, { status: 502 });
  }

  let upserted = 0;
  for (const s of stats) {
    const row = v2cStatToSessionRow(s);
    try {
      await db
        .insert(wallboxSessions)
        .values(row)
        .onConflictDoUpdate({
          target: [wallboxSessions.deviceId, wallboxSessions.idCharge],
          set: {
            startedAt: row.startedAt,
            endedAt: row.endedAt,
            energyKwh: row.energyKwh,
            costEur: row.costEur,
            costFvEur: row.costFvEur,
            energyByHour: row.energyByHour,
            rfidCode: row.rfidCode,
            rfidName: row.rfidName,
            finished: row.finished,
            updatedAt: row.updatedAt,
          },
        });
      upserted++;
    } catch {
      // ignora la singola riga in errore, continua col resto
    }
  }

  return Response.json({ ok: true, deviceId, fetched: stats.length, upserted });
}
