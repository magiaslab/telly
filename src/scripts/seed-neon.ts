/**
 * Seed Neon DB con dati storici realistici (30 giorni):
 * - Telemetria ogni 15 min (per AreaChart SoC)
 * - Ricariche notturne 01:00-05:00 (Octopus 0.15€/kWh)
 * - Viaggi: 2 A/R Livorno + 2 A/R Venturina a settimana, ~150 Wh/km
 *
 * Esecuzione: npm run seed (carica .env automaticamente)
 * Richiede DATABASE_URL e (opzionale) MOCK_VIN o TESLA_VIN.
 */
import "dotenv/config";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { telemetries, chargingEvents, trips } from "../db/schema";
import { MOCK_VIN, MOCK_LOCATIONS } from "../lib/mock-tesla-factory";

const OCTOPUS_EUR_PER_KWH = 0.15;
const WH_PER_KM = 150; // consumo stimato Model Y
const BATTERY_CAPACITY_KWH = 75;
const START_ODOMETER_KM = 300;

// Distanze approssimative da San Vincenzo (km)
const KM_LIVORNO_ONE_WAY = 55;
const KM_VENTURINA_ONE_WAY = 20;

const vin = process.env.MOCK_VIN ?? process.env.TESLA_VIN ?? MOCK_VIN;

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url || url.includes("placeholder")) {
    throw new Error("DATABASE_URL non impostato o placeholder. Usa un DB Neon reale per lo seed.");
  }
  return url;
}

function addMinutes(d: Date, minutes: number): Date {
  const out = new Date(d);
  out.setMinutes(out.getMinutes() + minutes);
  return out;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

async function main() {
  const sql = neon(getConnectionString());
  const db = drizzle(sql);

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  console.log("Seed Neon: cancellazione dati esistenti per VIN", vin);
  await db.delete(telemetries).where(eq(telemetries.vin, vin));
  await db.delete(chargingEvents).where(eq(chargingEvents.vin, vin));
  await db.delete(trips).where(eq(trips.vin, vin));

  // ---- TRIPS ----
  // 2 A/R Livorno + 2 A/R Venturina per settimana
  const tripRows: typeof trips.$inferInsert[] = [];
  let totalTripKm = 0;
  const livorno = MOCK_LOCATIONS.livornoViaGaribaldi;
  const venturina = MOCK_LOCATIONS.venturina;
  const home = MOCK_LOCATIONS.sanVincenzo;

  for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    // Lun-Ven: 2 viaggi Livorno (mattina/rientro, pomeriggio/rientro) + 2 Venturina
    const nLivorno = 2;
    const nVenturina = 2;
    const startBase = startOfDay(new Date(d));

    for (let i = 0; i < nLivorno; i++) {
      const startAt = addMinutes(startBase, 8 * 60 + i * 4 * 60);
      const endAt = addMinutes(startAt, 90);
      const km = KM_LIVORNO_ONE_WAY * 2;
      const kwhConsumed = (km * WH_PER_KM) / 1000;
      totalTripKm += km;
      tripRows.push({
        vin,
        startedAt: startAt,
        endedAt: endAt,
        startLat: home.lat,
        startLon: home.lon,
        endLat: home.lat,
        endLon: home.lon,
        km,
        kWhConsumed: Math.round(kwhConsumed * 100) / 100,
      });
    }
    for (let i = 0; i < nVenturina; i++) {
      const startAt = addMinutes(startBase, 14 * 60 + i * 2 * 60);
      const endAt = addMinutes(startAt, 45);
      const km = KM_VENTURINA_ONE_WAY * 2;
      const kwhConsumed = (km * WH_PER_KM) / 1000;
      totalTripKm += km;
      tripRows.push({
        vin,
        startedAt: startAt,
        endedAt: endAt,
        startLat: home.lat,
        startLon: home.lon,
        endLat: home.lat,
        endLon: home.lon,
        km,
        kWhConsumed: Math.round(kwhConsumed * 100) / 100,
      });
    }
  }

  console.log("Inserimento", tripRows.length, "viaggi, km totali", totalTripKm.toFixed(0));
  if (tripRows.length > 0) {
    await db.insert(trips).values(tripRows);
  }

  // ---- CHARGING EVENTS ----
  // Ricarica notturna 01:00-05:00 ogni giorno; kWh aggiunti per compensare consumo giornaliero
  const kwhPerDay = totalTripKm / 30 * (WH_PER_KM / 1000);
  const chargeRows: typeof chargingEvents.$inferInsert[] = [];

  for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
    const startAt = new Date(d);
    startAt.setHours(1, 0, 0, 0);
    const endAt = new Date(d);
    endAt.setHours(5, 0, 0, 0);
    const kWhAdded = Math.round((kwhPerDay * (0.95 + Math.random() * 0.1)) * 100) / 100;
    const costEur = Math.round(kWhAdded * OCTOPUS_EUR_PER_KWH * 100) / 100;
    chargeRows.push({
      vin,
      startedAt: startAt,
      endedAt: endAt,
      kWhAdded,
      costEur,
    });
  }
  console.log("Inserimento", chargeRows.length, "ricariche");
  await db.insert(chargingEvents).values(chargeRows);

  // ---- TELEMETRY (ogni 15 min) ----
  const telemetryRows: typeof telemetries.$inferInsert[] = [];
  const intervalMinutes = 15;
  let currentOdometer = START_ODOMETER_KM;
  let cumulativeTripKwh = 0;
  let cumulativeChargeKwh = 0;
  const tripKwhByTime = new Map<number, number>();
  const chargeKwhByTime = new Map<number, number>();

  let runningTripKwh = 0;
  let runningChargeKwh = 0;
  for (const t of tripRows.sort((a, b) => (a.startedAt as Date).getTime() - (b.startedAt as Date).getTime())) {
    const endTime = (t.endedAt as Date).getTime();
    runningTripKwh += t.kWhConsumed ?? 0;
    tripKwhByTime.set(endTime, runningTripKwh);
  }
  for (const c of chargeRows.sort((a, b) => (a.startedAt as Date).getTime() - (b.startedAt as Date).getTime())) {
    const endTime = (c.endedAt as Date).getTime();
    runningChargeKwh += c.kWhAdded ?? 0;
    chargeKwhByTime.set(endTime, runningChargeKwh);
  }

  const getCumulativeTripKwh = (ts: Date): number => {
    const t = ts.getTime();
    let best = 0;
    for (const [end, kwh] of tripKwhByTime) {
      if (end <= t) best = kwh;
    }
    return best;
  };
  const getCumulativeChargeKwh = (ts: Date): number => {
    const t = ts.getTime();
    let best = 0;
    for (const [end, kwh] of chargeKwhByTime) {
      if (end <= t) best = kwh;
    }
    return best;
  };

  let slot = new Date(thirtyDaysAgo);
  slot.setMinutes(0, 0, 0);
  const endSlot = new Date(now);
  endSlot.setMinutes(59, 59, 999);

  while (slot <= endSlot) {
    const tripKwh = getCumulativeTripKwh(slot);
    const chargeKwh = getCumulativeChargeKwh(slot);
    const netKwh = chargeKwh - tripKwh;
    const socPct = Math.round(80 + (netKwh / BATTERY_CAPACITY_KWH) * 100);
    const soc = Math.min(80, Math.max(20, socPct));
    const rangeKm = (soc / 100) * 450;
    const hour = slot.getHours();
    const isCharging = hour >= 1 && hour < 5 ? true : false;
    const powerUsage = isCharging ? 4.6 : null;
    const odometer = START_ODOMETER_KM + (tripKwh * 1000) / WH_PER_KM;

    telemetryRows.push({
      vin,
      soc,
      odometer: Math.round(odometer * 10) / 10,
      range: Math.round(rangeKm * 10) / 10,
      isCharging,
      powerUsage: powerUsage ?? undefined,
      tempInside: 22,
      lat: home.lat,
      lon: home.lon,
      timestamp: new Date(slot),
    });

    slot = addMinutes(slot, intervalMinutes);
  }

  console.log("Inserimento", telemetryRows.length, "record telemetria");
  const BATCH = 500;
  for (let i = 0; i < telemetryRows.length; i += BATCH) {
    await db.insert(telemetries).values(telemetryRows.slice(i, i + BATCH));
  }

  console.log("Seed completato.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
