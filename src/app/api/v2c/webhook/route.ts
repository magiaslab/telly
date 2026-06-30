import { NextRequest } from "next/server";
import { db, wallboxSessions } from "@/db";

export const dynamic = "force-dynamic";

/** Prezzo €/kWh usato per stimare il costo della sessione dal webhook (la sync sovrascrive col costo reale). */
const PRICE_EUR_PER_KWH = Number(process.env.V2C_PRICE_EUR_PER_KWH ?? "0.15");

type V2cWebhookPayload = {
  idCharge?: string;
  deviceId?: string;
  method?: "startcharge" | "endcharge";
  datetime?: string;
  energy?: string;
  energyByHour?: string;
  rfidCode?: string;
};

/** Converte "YYYY-MM-DD HH:MM:SS" (ora locale wallbox) in Date. */
function parseV2cDate(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}

const numOrZero = (v?: string) => {
  const n = parseFloat(v ?? "");
  return Number.isFinite(n) ? n : 0;
};

/**
 * Webhook V2C: riceve gli eventi "charge started" / "charge ended" e li salva su Neon.
 * Registra l'URL `<dominio>/api/v2c/webhook` nel pannello V2C.
 * Sicurezza opzionale: se è impostata V2C_WEBHOOK_SECRET, il valore va passato come
 * header `x-webhook-secret` o query `?secret=`.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.V2C_WEBHOOK_SECRET;
  if (secret) {
    const provided =
      request.headers.get("x-webhook-secret") ??
      request.nextUrl.searchParams.get("secret") ??
      "";
    if (provided !== secret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let payload: V2cWebhookPayload;
  try {
    payload = (await request.json()) as V2cWebhookPayload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { idCharge, deviceId, method } = payload;
  if (!idCharge || !deviceId) {
    // Rispondiamo 200 per non far ritentare V2C all'infinito su payload incompleti.
    return Response.json({ ok: true, ignored: true });
  }

  const eventDate = parseV2cDate(payload.datetime);
  const isEnd = method === "endcharge";
  const energy = numOrZero(payload.energy);

  try {
    if (isEnd) {
      await db
        .insert(wallboxSessions)
        .values({
          deviceId,
          idCharge,
          startedAt: parseV2cDate(idCharge),
          endedAt: eventDate,
          energyKwh: energy,
          costEur: Math.round(energy * PRICE_EUR_PER_KWH * 100) / 100,
          energyByHour: payload.energyByHour || null,
          rfidCode: payload.rfidCode || null,
          finished: true,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [wallboxSessions.deviceId, wallboxSessions.idCharge],
          set: {
            endedAt: eventDate,
            energyKwh: energy,
            costEur: Math.round(energy * PRICE_EUR_PER_KWH * 100) / 100,
            energyByHour: payload.energyByHour || null,
            rfidCode: payload.rfidCode || null,
            finished: true,
            updatedAt: new Date(),
          },
        });
    } else {
      await db
        .insert(wallboxSessions)
        .values({
          deviceId,
          idCharge,
          startedAt: eventDate ?? parseV2cDate(idCharge),
          rfidCode: payload.rfidCode || null,
          finished: false,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [wallboxSessions.deviceId, wallboxSessions.idCharge],
          set: {
            startedAt: eventDate ?? parseV2cDate(idCharge),
            updatedAt: new Date(),
          },
        });
    }
  } catch (e) {
    return Response.json({ error: "DB error", details: String(e) }, { status: 500 });
  }

  return Response.json({ ok: true, method: method ?? "unknown" });
}
