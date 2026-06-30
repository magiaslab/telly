import { cookies } from "next/headers";
import { db, telemetries, chargingEvents, wallboxSessions } from "@/db";
import { eq, desc, and, gte, lt, asc } from "drizzle-orm";
import { getEffectiveVin } from "@/lib/use-mock";
import {
  getV2cConnected,
  getV2cCurrentState,
  getV2cDeviceStatistics,
  getV2cMonthTotals,
  monthRangeRome,
  parseV2cLocalDateTime,
  resolveV2cDeviceId,
  v2cStatToSessionRow,
  type V2cCurrentState,
} from "@/lib/v2c-api";
import type { WallboxSession } from "@/db";
import {
  getTeslaAccessToken,
  getTeslaRegion,
  getTeslaUserMe,
  listVehicles,
  getTeslaOrders,
  getTeslaFleetBaseUrl,
} from "@/lib/tesla-api";

export const DIESEL_EUR_PER_L = 1.75;
export const DIESEL_KM_PER_L = 15;
const MILES_TO_KM = 1.60934;

const getVin = () => getEffectiveVin();

/**
 * Corregge letture odometro salvate per errore come miglia (pre-fix sync).
 * Es. 562 mi mostrate come km → ~904 km reali.
 */
export function normalizeOdometerKm(value: number, referenceKm: number): number {
  if (value <= 0 || referenceKm <= 0) return value;
  const ratio = referenceKm / value;
  if (ratio >= 1.55 && ratio <= 1.65) {
    return Math.round(value * MILES_TO_KM * 10) / 10;
  }
  const asKm = value * MILES_TO_KM;
  if (Math.abs(asKm - referenceKm) / referenceKm < 0.04) {
    return Math.round(asKm * 10) / 10;
  }
  return value;
}

export function dieselCostForKm(km: number): number {
  return Math.round((km / DIESEL_KM_PER_L) * DIESEL_EUR_PER_L * 100) / 100;
}

function monthLabelRome(): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

/** Km percorsi da delta odometro tra letture telemetria. */
async function odometerKmDelta(
  vin: string,
  rangeStart: Date,
  rangeEnd?: Date
): Promise<{
  km: number;
  odometerStart: number | null;
  odometerEnd: number | null;
  odometerStartRaw: number | null;
  correctedMilesAsKm: boolean;
  samples: number;
}> {
  const conditions = [eq(telemetries.vin, vin), gte(telemetries.timestamp, rangeStart)];
  if (rangeEnd) {
    conditions.push(lt(telemetries.timestamp, rangeEnd));
  }

  const inRange = await db
    .select({ odometer: telemetries.odometer, timestamp: telemetries.timestamp })
    .from(telemetries)
    .where(and(...conditions))
    .orderBy(asc(telemetries.timestamp));

  const [before] = await db
    .select({ odometer: telemetries.odometer })
    .from(telemetries)
    .where(and(eq(telemetries.vin, vin), lt(telemetries.timestamp, rangeStart)))
    .orderBy(desc(telemetries.timestamp))
    .limit(1);

  const points = inRange.filter((r) => (r.odometer ?? 0) > 0);
  const rawStart = before?.odometer ?? points[0]?.odometer ?? null;
  const rawEnd =
    points.length > 0 ? points[points.length - 1]!.odometer : before?.odometer ?? null;

  if (rawStart == null || rawEnd == null) {
    return {
      km: 0,
      odometerStart: rawStart,
      odometerEnd: rawEnd,
      odometerStartRaw: rawStart,
      correctedMilesAsKm: false,
      samples: points.length,
    };
  }

  const ref = rawEnd;
  const normStart = normalizeOdometerKm(rawStart, ref);
  const normEnd = normalizeOdometerKm(rawEnd, ref);
  const correctedMilesAsKm = Math.abs(normStart - rawStart) > 0.5;

  if (normEnd < normStart) {
    return {
      km: 0,
      odometerStart: normStart,
      odometerEnd: normEnd,
      odometerStartRaw: rawStart,
      correctedMilesAsKm,
      samples: points.length,
    };
  }

  return {
    km: Math.round((normEnd - normStart) * 10) / 10,
    odometerStart: normStart,
    odometerEnd: normEnd,
    odometerStartRaw: rawStart,
    correctedMilesAsKm,
    samples: points.length,
  };
}

export type MonthlySummary = {
  monthLabel: string;
  /** Km percorsi nel mese (delta odometro, non totale auto). */
  kmDriven: number;
  /** Odometro totale attuale (km cumulativi sull'auto). */
  currentOdometerKm: number | null;
  odometerStart: number | null;
  odometerEnd: number | null;
  odometerStartRaw: number | null;
  correctedMilesAsKm: boolean;
  telemetrySamples: number;
  kmSource: "odometer_delta" | "insufficient_data";
  homeChargeKwh: number;
  homeChargeEur: number;
  homeChargeSessions: number;
  publicChargeKwh: number;
  publicChargeEur: number;
  totalChargeEur: number;
  dieselCostEur: number;
  savedVsDieselEur: number;
  consumptionKwhPer100Km: number | null;
};

/** Riepilogo mese corrente (Europe/Rome): km da odometro, ricarica casa da wallbox DB. */
export async function getMonthlySummary(): Promise<MonthlySummary> {
  const empty: MonthlySummary = {
    monthLabel: monthLabelRome(),
    kmDriven: 0,
    currentOdometerKm: null,
    odometerStart: null,
    odometerEnd: null,
    odometerStartRaw: null,
    correctedMilesAsKm: false,
    telemetrySamples: 0,
    kmSource: "insufficient_data",
    homeChargeKwh: 0,
    homeChargeEur: 0,
    homeChargeSessions: 0,
    publicChargeKwh: 0,
    publicChargeEur: 0,
    totalChargeEur: 0,
    dieselCostEur: 0,
    savedVsDieselEur: 0,
    consumptionKwhPer100Km: null,
  };

  const vin = getVin();
  if (!vin) return empty;

  try {
    const { startDate } = monthRangeRome();
    const odo = await odometerKmDelta(vin, startDate);
    const deviceId = await resolveV2cDeviceId();

    let homeChargeKwh = 0;
    let homeChargeEur = 0;
    let homeChargeSessions = 0;

    if (deviceId) {
      const sessions = await db
        .select()
        .from(wallboxSessions)
        .where(
          and(
            eq(wallboxSessions.deviceId, deviceId),
            gte(wallboxSessions.startedAt, startDate)
          )
        );
      homeChargeKwh = sessions.reduce((s, r) => s + (r.energyKwh ?? 0), 0);
      homeChargeEur = sessions.reduce((s, r) => s + (r.costEur ?? 0), 0);
      homeChargeSessions = sessions.length;
    }

    const kmDriven = odo.km;
    const dieselCostEur = dieselCostForKm(kmDriven);
    const totalChargeEur = homeChargeEur + empty.publicChargeEur;
    const savedVsDieselEur = Math.round((dieselCostEur - totalChargeEur) * 100) / 100;

    let consumptionKwhPer100Km: number | null = null;
    if (kmDriven > 0 && homeChargeKwh > 0) {
      consumptionKwhPer100Km = Math.round((homeChargeKwh / kmDriven) * 100 * 10) / 10;
    }

    return {
      monthLabel: monthLabelRome(),
      kmDriven,
      currentOdometerKm: odo.odometerEnd,
      odometerStart: odo.odometerStart,
      odometerEnd: odo.odometerEnd,
      odometerStartRaw: odo.odometerStartRaw,
      correctedMilesAsKm: odo.correctedMilesAsKm,
      telemetrySamples: odo.samples,
      kmSource:
        odo.odometerEnd != null && (odo.samples >= 1 || odo.odometerStart != null)
          ? "odometer_delta"
          : "insufficient_data",
      homeChargeKwh: Math.round(homeChargeKwh * 100) / 100,
      homeChargeEur: Math.round(homeChargeEur * 100) / 100,
      homeChargeSessions,
      publicChargeKwh: 0,
      publicChargeEur: 0,
      totalChargeEur: Math.round(totalChargeEur * 100) / 100,
      dieselCostEur,
      savedVsDieselEur,
      consumptionKwhPer100Km,
    };
  } catch {
    return empty;
  }
}

export async function getLatestTelemetry() {
  const vin = getVin();
  if (!vin) return null;
  try {
    const rows = await db
      .select()
      .from(telemetries)
      .where(eq(telemetries.vin, vin))
      .orderBy(desc(telemetries.timestamp))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function getTelemetriesForChart(days = 7) {
  const vin = getVin();
  if (!vin) return [];
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const rows = await db
      .select({
        timestamp: telemetries.timestamp,
        soc: telemetries.soc,
        odometer: telemetries.odometer,
      })
      .from(telemetries)
      .where(eq(telemetries.vin, vin))
      .orderBy(telemetries.timestamp);
    return rows.filter((r) => r.timestamp && new Date(r.timestamp) >= since);
  } catch {
    return [];
  }
}

export async function getChargingCostThisMonth() {
  const vin = getVin();
  if (!vin) return { totalEur: 0, totalKwh: 0, events: [] };
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const rows = await db
      .select()
      .from(chargingEvents)
      .where(
        and(
          eq(chargingEvents.vin, vin),
          gte(chargingEvents.startedAt, startOfMonth)
        )
      );
    const totalEur = rows.reduce((s, e) => s + (e.costEur ?? 0), 0);
    const totalKwh = rows.reduce((s, e) => s + (e.kWhAdded ?? 0), 0);
    return { totalEur, totalKwh, events: rows };
  } catch {
    return { totalEur: 0, totalKwh: 0, events: [] };
  }
}

/** Dati per BarChart risparmio vs Diesel (ultime N settimane, km da odometro + costi wallbox). */
export async function getSavingsForBarChart(weeks = 4) {
  const vin = getVin();
  if (!vin) return { series: [] };
  try {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - weeks * 7);
    start.setHours(0, 0, 0, 0);

    const deviceId = await resolveV2cDeviceId();
    let wallboxRows: { costEur: number; startedAt: Date | null }[] = [];
    if (deviceId) {
      const rows = await db
        .select({ costEur: wallboxSessions.costEur, startedAt: wallboxSessions.startedAt })
        .from(wallboxSessions)
        .where(
          and(
            eq(wallboxSessions.deviceId, deviceId),
            gte(wallboxSessions.startedAt, start)
          )
        );
      wallboxRows = rows.map((r) => ({
        costEur: r.costEur ?? 0,
        startedAt: r.startedAt ? new Date(r.startedAt) : null,
      }));
    }

    const weekFmt = new Intl.DateTimeFormat("it-IT", {
      timeZone: "Europe/Rome",
      day: "numeric",
      month: "short",
    });

    const series: { period: string; spentEur: number; dieselEur: number; savedEur: number; km: number }[] = [];

    for (let w = 0; w < weeks; w++) {
      const weekStart = new Date(start);
      weekStart.setDate(weekStart.getDate() + w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const odo = await odometerKmDelta(vin, weekStart, weekEnd);
      const km = odo.km;
      const spentEur = wallboxRows
        .filter((r) => r.startedAt && r.startedAt >= weekStart && r.startedAt < weekEnd)
        .reduce((s, r) => s + r.costEur, 0);
      const dieselEur = dieselCostForKm(km);
      const savedEur = dieselEur - spentEur;

      const period =
        w === weeks - 1
          ? `${weekFmt.format(weekStart)}–oggi`
          : `${weekFmt.format(weekStart)}–${weekFmt.format(new Date(weekEnd.getTime() - 86400000))}`;

      series.push({
        period,
        km,
        spentEur: Math.round(spentEur * 100) / 100,
        dieselEur,
        savedEur: Math.round(savedEur * 100) / 100,
      });
    }

    return { series };
  } catch {
    return { series: [] };
  }
}

export type TeslaAccountData = {
  user: { id: number; email?: string; full_name?: string; profile_image_url?: string };
  region: string;
  vehicles: Array<{
    id: number;
    vehicle_id: number;
    vin: string;
    display_name?: string;
    state?: string;
    option_codes?: string;
  }>;
  orders: unknown;
};

/** Dati account Tesla dato un refresh token (usato da API route e da fetch dashboard). Lancia se refresh o API falliscono. */
export async function fetchTeslaAccountData(
  refreshToken: string
): Promise<TeslaAccountData> {
  const accessToken = await getTeslaAccessToken(refreshToken);
  const regionRes = await getTeslaRegion(accessToken);
  const region = regionRes.response?.region ?? "NA";
  const baseUrl = getTeslaFleetBaseUrl(region === "EU" ? "EU" : "NA");

  const [meRes, vehiclesRes, ordersRes] = await Promise.all([
    getTeslaUserMe(accessToken, baseUrl),
    listVehicles(accessToken, baseUrl),
    getTeslaOrders(accessToken, baseUrl).catch(() => ({ response: null })),
  ]);

  return {
    user: meRes.response ?? { id: 0 },
    region,
    vehicles: vehiclesRes.response ?? [],
    orders: ordersRes.response ?? null,
  };
}

/** Profilo Tesla + veicoli + ordini. In login Tesla legge il token da JWT (via /api/tesla/account), altrimenti cookie/env. */
export async function getTeslaAccountAndVehicles(): Promise<TeslaAccountData | null> {
  const base =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const cookieStore = await cookies();
  const res = await fetch(`${base}/api/tesla/account`, {
    headers: { Cookie: cookieStore.toString() },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

// ---------------------------------------------------------------------------
// Wallbox V2C
// ---------------------------------------------------------------------------

/** Vista normalizzata di una ricarica wallbox (da DB o live V2C). */
export type WallboxSessionView = {
  idCharge: string;
  startedAt: Date | null;
  endedAt: Date | null;
  energyKwh: number;
  costEur: number;
  rfidName: string | null;
  finished: boolean;
};

export type WallboxData = {
  deviceId: string | null;
  connected: boolean;
  status: V2cCurrentState | null;
  sessions: WallboxSessionView[];
  monthEnergyKwh: number;
  monthCostEur: number;
  monthChargeCount: number;
  /** Come sono stati calcolati i totali mensili. */
  monthStatsSource: "v2c_global_api" | "db" | "sessions_partial" | "none";
  source: "db" | "live" | "none";
};

const toView = (s: WallboxSession): WallboxSessionView => ({
  idCharge: s.idCharge,
  startedAt: s.startedAt ? new Date(s.startedAt) : null,
  endedAt: s.endedAt ? new Date(s.endedAt) : null,
  energyKwh: s.energyKwh,
  costEur: s.costEur,
  rfidName: s.rfidName,
  finished: s.finished,
});

const monthAggregateFromSessions = (
  sessions: WallboxSessionView[],
  startDate: Date
) => {
  const inMonth = sessions.filter((s) => s.startedAt && s.startedAt >= startDate);
  return {
    monthEnergyKwh: inMonth.reduce((sum, s) => sum + (s.energyKwh ?? 0), 0),
    monthCostEur: inMonth.reduce((sum, s) => sum + (s.costEur ?? 0), 0),
    monthChargeCount: inMonth.length,
  };
};

/**
 * Dati completi wallbox per la dashboard: stato realtime + storico ricariche.
 * Totali mensili da /stadistic/global/me (come app V2C). Tabella da DB o ultime 5 live.
 */
export async function getWallboxData(limit = 20): Promise<WallboxData> {
  const { startDate } = monthRangeRome();
  const emptyMonth = {
    monthEnergyKwh: 0,
    monthCostEur: 0,
    monthChargeCount: 0,
    monthStatsSource: "none" as const,
  };

  const deviceId = await resolveV2cDeviceId();
  if (!deviceId) {
    return {
      deviceId: null,
      connected: false,
      status: null,
      sessions: [],
      ...emptyMonth,
      source: "none",
    };
  }

  const [status, connected, monthTotals] = await Promise.all([
    getV2cCurrentState(deviceId).catch(() => null),
    getV2cConnected(deviceId).catch(() => false),
    getV2cMonthTotals(deviceId).catch(() => ({ totalEnergy: 0, totalCharges: 0 })),
  ]);

  let sessions: WallboxSessionView[] = [];
  let source: WallboxData["source"] = "none";
  let monthStatsSource: WallboxData["monthStatsSource"] = "none";
  let monthEnergyKwh = 0;
  let monthCostEur = 0;
  let monthChargeCount = 0;

  try {
    const rows = await db
      .select()
      .from(wallboxSessions)
      .where(eq(wallboxSessions.deviceId, deviceId))
      .orderBy(desc(wallboxSessions.startedAt))
      .limit(limit);
    if (rows.length > 0) {
      sessions = rows.map(toView);
      source = "db";
    }
  } catch {
    // DB non disponibile
  }

  if (sessions.length === 0) {
    try {
      const { start, end } = monthRangeRome();
      const stats = await getV2cDeviceStatistics(deviceId, start, end);
      if (stats.length > 0) {
        sessions = stats
          .map((s) => v2cStatToSessionRow(s))
          .map((r) => ({
            idCharge: r.idCharge,
            startedAt: r.startedAt,
            endedAt: r.endedAt,
            energyKwh: r.energyKwh,
            costEur: r.costEur,
            rfidName: r.rfidName,
            finished: r.finished,
          }))
          .sort(
            (a, b) =>
              (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0)
          );
        source = "live";
      }
    } catch {
      // nessuna sessione
    }
  }

  if (monthTotals.totalEnergy > 0 || monthTotals.totalCharges > 0) {
    monthEnergyKwh = monthTotals.totalEnergy;
    monthChargeCount = monthTotals.totalCharges;
    monthStatsSource = "v2c_global_api";
    // L'API globale non espone il costo: stimiamo dalla media costo/kWh delle sessioni note
    const partial = monthAggregateFromSessions(sessions, startDate);
    if (partial.monthEnergyKwh > 0 && partial.monthCostEur > 0) {
      const avgCostPerKwh = partial.monthCostEur / partial.monthEnergyKwh;
      monthCostEur = monthEnergyKwh * avgCostPerKwh;
    } else if (sessions.length > 0) {
      const avgCostPerKwh =
        sessions.reduce((s, x) => s + x.costEur, 0) /
        Math.max(sessions.reduce((s, x) => s + x.energyKwh, 0), 1);
      monthCostEur = monthEnergyKwh * avgCostPerKwh;
    }
  } else {
    const partial = monthAggregateFromSessions(sessions, startDate);
    monthEnergyKwh = partial.monthEnergyKwh;
    monthCostEur = partial.monthCostEur;
    monthChargeCount = partial.monthChargeCount;
    monthStatsSource = sessions.length > 0 ? "sessions_partial" : "none";
  }

  // Se abbiamo sessioni DB nel mese, il costo mensile è più preciso dalla somma DB
  if (source === "db") {
    try {
      const monthRows = await db
        .select()
        .from(wallboxSessions)
        .where(
          and(
            eq(wallboxSessions.deviceId, deviceId),
            gte(wallboxSessions.startedAt, startDate)
          )
        );
      if (monthRows.length > 0) {
        const dbAgg = monthAggregateFromSessions(monthRows.map(toView), startDate);
        if (dbAgg.monthEnergyKwh > 0) {
          monthEnergyKwh = dbAgg.monthEnergyKwh;
          monthCostEur = dbAgg.monthCostEur;
          monthChargeCount = dbAgg.monthChargeCount;
          monthStatsSource = "db";
        }
      }
    } catch {
      // mantieni stima API globale
    }
  }

  return {
    deviceId,
    connected,
    status,
    sessions,
    monthEnergyKwh: Math.round(monthEnergyKwh * 100) / 100,
    monthCostEur: Math.round(monthCostEur * 100) / 100,
    monthChargeCount,
    monthStatsSource,
    source,
  };
}
