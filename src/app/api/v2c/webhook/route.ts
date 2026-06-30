import { NextRequest } from "next/server";
import { db, wallboxSessions } from "@/db";
import { parseV2cLocalDateTime } from "@/lib/v2c-api";

export const dynamic = "force-dynamic";

/** Prezzo €/kWh usato solo se il webhook non include il costo reale V2C. */
const PRICE_EUR_PER_KWH = Number(process.env.V2C_PRICE_EUR_PER_KWH ?? "0.15");

type V2cWebhookPayload = {
  idCharge?: string;
  deviceId?: string;
  method?: "startcharge" | "endcharge";
  datetime?: string;
  energy?: string;
  cost?: string;
  energyByHour?: string;
  rfidCode?: string;
};

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

  const eventDate = parseV2cLocalDateTime(payload.datetime);
  const isEnd = method === "endcharge";
  const energy = numOrZero(payload.energy);
  const costFromPayload = numOrZero(payload.cost);
  const costEur =
    costFromPayload > 0
      ? costFromPayload
      : Math.round(energy * PRICE_EUR_PER_KWH * 100) / 100;

  try {
    if (isEnd) {
      await db
        .insert(wallboxSessions)
        .values({
          deviceId,
          idCharge,
          startedAt: parseV2cLocalDateTime(idCharge),
          endedAt: eventDate,
          energyKwh: energy,
          costEur,
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
            costEur,
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
          startedAt: eventDate ?? parseV2cLocalDateTime(idCharge),
          rfidCode: payload.rfidCode || null,
          finished: false,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [wallboxSessions.deviceId, wallboxSessions.idCharge],
          set: {
            startedAt: eventDate ?? parseV2cLocalDateTime(idCharge),
            updatedAt: new Date(),
          },
        });
    }
  } catch (e) {
    return Response.json({ error: "DB error", details: String(e) }, { status: 500 });
  }

  return Response.json({ ok: true, method: method ?? "unknown" });
}
