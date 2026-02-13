import { cookies } from "next/headers";
import { db, telemetries, chargingEvents, trips } from "@/db";
import { eq, desc, and, gte } from "drizzle-orm";
import { getEffectiveVin } from "@/lib/use-mock";
import {
  getTeslaAccessToken,
  getTeslaRegion,
  getTeslaUserMe,
  listVehicles,
  getTeslaOrders,
  getTeslaFleetBaseUrl,
} from "@/lib/tesla-api";

const DIESEL_EUR_PER_L = 1.75;
const DIESEL_KM_PER_L = 15; // Kia 1.4 Diesel

const getVin = () => getEffectiveVin();

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

/** Dati per BarChart risparmio vs Diesel (ultime N settimane). */
export async function getSavingsForBarChart(weeks = 4) {
  const vin = getVin();
  if (!vin) return { series: [] };
  try {
    const start = new Date();
    start.setDate(start.getDate() - weeks * 7);
    start.setHours(0, 0, 0, 0);

    const tripRows = await db
      .select({ km: trips.km, kWhConsumed: trips.kWhConsumed, endedAt: trips.endedAt })
      .from(trips)
      .where(
        and(eq(trips.vin, vin), gte(trips.endedAt, start))
      );
    const chargeRows = await db
      .select({ costEur: chargingEvents.costEur, kWhAdded: chargingEvents.kWhAdded, startedAt: chargingEvents.startedAt })
      .from(chargingEvents)
      .where(
        and(eq(chargingEvents.vin, vin), gte(chargingEvents.startedAt, start))
      );

    const series: { period: string; spentEur: number; dieselEur: number; savedEur: number }[] = [];
    for (let w = 0; w < weeks; w++) {
    const weekStart = new Date(start);
    weekStart.setDate(weekStart.getDate() + w * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekTrips = tripRows.filter(
      (t) => t.endedAt && new Date(t.endedAt) >= weekStart && new Date(t.endedAt) < weekEnd
    );
    const weekCharges = chargeRows.filter(
      (c) => c.startedAt && new Date(c.startedAt) >= weekStart && new Date(c.startedAt) < weekEnd
    );
    const km = weekTrips.reduce((s, t) => s + (t.km ?? 0), 0);
    const spentEur = weekCharges.reduce((s, c) => s + (c.costEur ?? 0), 0);
    const dieselEur = (km / DIESEL_KM_PER_L) * DIESEL_EUR_PER_L;
    const savedEur = dieselEur - spentEur;

    series.push({
      period: `Sett. ${w + 1}`,
      spentEur: Math.round(spentEur * 100) / 100,
      dieselEur: Math.round(dieselEur * 100) / 100,
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
