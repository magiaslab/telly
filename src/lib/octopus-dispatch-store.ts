import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db, octopusDispatches } from "@/db";

/** Allineato a octopus-api INTELLIGENT_DISCOUNT. */
const INTELLIGENT_DISCOUNT = 0.3;

export type OctopusDispatchInput = {
  start: string;
  end: string;
  deltaKwh: number;
};

export type OctopusDispatchSyncResult = {
  fetched: number;
  upserted: number;
  skipped: number;
};

export type OctopusMonthStats = {
  energyKwh: number;
  energyCostEur: number;
  savingEur: number;
  dispatchCount: number;
};

function dispatchEnergyKwh(deltaKwh: number): number {
  return deltaKwh < 0 ? Math.abs(deltaKwh) : 0;
}

function rowFromDispatch(
  accountNumber: string,
  deviceId: string | null,
  d: OctopusDispatchInput,
  unitRateEurPerKwh: number
) {
  const energyKwh = dispatchEnergyKwh(d.deltaKwh);
  const energyCostEur = Math.round(energyKwh * unitRateEurPerKwh * 100) / 100;
  const savingEur = Math.round(energyCostEur * INTELLIGENT_DISCOUNT * 100) / 100;
  return {
    accountNumber,
    deviceId,
    windowStart: new Date(d.start),
    windowEnd: new Date(d.end),
    deltaKwh: d.deltaKwh,
    energyKwh,
    unitRateEurPerKwh,
    energyCostEur,
    savingEur,
    updatedAt: new Date(),
  };
}

/** Upsert delle finestre API Kraken (chiave: account + inizio + fine). */
export async function upsertOctopusDispatches(
  accountNumber: string,
  deviceId: string | null,
  dispatches: OctopusDispatchInput[],
  unitRateEurPerKwh: number
): Promise<OctopusDispatchSyncResult> {
  let upserted = 0;
  let skipped = 0;

  for (const d of dispatches) {
    if (dispatchEnergyKwh(d.deltaKwh) <= 0) {
      skipped++;
      continue;
    }
    const row = rowFromDispatch(accountNumber, deviceId, d, unitRateEurPerKwh);
    try {
      await db
        .insert(octopusDispatches)
        .values(row)
        .onConflictDoUpdate({
          target: [
            octopusDispatches.accountNumber,
            octopusDispatches.windowStart,
            octopusDispatches.windowEnd,
          ],
          set: {
            deviceId: row.deviceId,
            deltaKwh: row.deltaKwh,
            energyKwh: row.energyKwh,
            unitRateEurPerKwh: row.unitRateEurPerKwh,
            energyCostEur: row.energyCostEur,
            savingEur: row.savingEur,
            updatedAt: row.updatedAt,
          },
        });
      upserted++;
    } catch {
      skipped++;
    }
  }

  return { fetched: dispatches.length, upserted, skipped };
}

function monthBoundsInRome(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  return { start, end };
}

export function currentMonthBoundsRome(): { year: number; month: number; start: Date; end: Date } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value ?? now.getUTCFullYear());
  const month = Number(parts.find((p) => p.type === "month")?.value ?? now.getUTCMonth() + 1);
  const { start, end } = monthBoundsInRome(year, month);
  return { year, month, start, end };
}

/** Totali mese corrente (Europe/Rome) dallo storico DB. */
export async function getOctopusMonthStatsFromDb(
  accountNumber: string
): Promise<OctopusMonthStats> {
  const { start, end } = currentMonthBoundsRome();
  const rows = await db
    .select()
    .from(octopusDispatches)
    .where(
      and(
        eq(octopusDispatches.accountNumber, accountNumber),
        gte(octopusDispatches.windowStart, start),
        lt(octopusDispatches.windowStart, end)
      )
    );

  const energyKwh = rows.reduce((s, r) => s + (r.energyKwh ?? 0), 0);
  const energyCostEur = rows.reduce((s, r) => s + (r.energyCostEur ?? 0), 0);
  const savingEur = rows.reduce((s, r) => s + (r.savingEur ?? 0), 0);

  return {
    energyKwh: Math.round(energyKwh * 100) / 100,
    energyCostEur: Math.round(energyCostEur * 100) / 100,
    savingEur: Math.round(savingEur * 100) / 100,
    dispatchCount: rows.length,
  };
}

export async function getStoredOctopusDispatches(
  accountNumber: string,
  limit = 20
): Promise<OctopusDispatchInput[]> {
  const rows = await db
    .select()
    .from(octopusDispatches)
    .where(eq(octopusDispatches.accountNumber, accountNumber))
    .orderBy(desc(octopusDispatches.windowStart))
    .limit(limit);

  return rows.map((r) => ({
    start: r.windowStart!.toISOString(),
    end: r.windowEnd!.toISOString(),
    deltaKwh: r.deltaKwh,
  }));
}

export async function countStoredOctopusDispatches(accountNumber: string): Promise<number> {
  const rows = await db
    .select({ id: octopusDispatches.id })
    .from(octopusDispatches)
    .where(eq(octopusDispatches.accountNumber, accountNumber));
  return rows.length;
}
