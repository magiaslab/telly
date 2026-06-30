/**
 * Client GraphQL per Octopus Energy Italia (istanza Kraken).
 *
 * Endpoint: https://api.oeit-kraken.energy/v1/graphql/
 * Docs IT: https://docs.oeit-kraken.energy/
 * Intelligent Octopus: https://octopusenergy.it/intelligent-octopus
 *
 * Intelligent Octopus (SmartFlex):
 * - L'utente imposta ora di partenza e % carica nell'app Octopus; Kraken gestisce le finestre.
 * - Sconto del 30% sulla componente energia per ogni kWh ottimizzato (non su tutti i kWh).
 * - Lo sconto viene accreditato in bolletta; i dispatch API indicano i kWh ottimizzati.
 * - Compatibile con tariffa Fissa 12M / Flex e dispositivi Tesla, V2C Trydan, ecc.
 */

import {
  countStoredOctopusDispatches,
  getOctopusMonthStatsFromDb,
  getStoredOctopusDispatches,
  upsertOctopusDispatches,
  type OctopusDispatchSyncResult,
} from "@/lib/octopus-dispatch-store";

export type { OctopusDispatchSyncResult };

const OCTOPUS_API_URL =
  process.env.OCTOPUS_API_URL || "https://api.oeit-kraken.energy/v1/graphql/";
const OCTOPUS_EMAIL = process.env.OCTOPUS_EMAIL;
const OCTOPUS_PASSWORD = process.env.OCTOPUS_PASSWORD;
const OCTOPUS_ACCOUNT_NUMBER = process.env.OCTOPUS_ACCOUNT_NUMBER;
const OCTOPUS_POD = process.env.OCTOPUS_POD;

/** Sconto Intelligent Octopus sulla componente energia (materia prima), solo kWh ottimizzati. */
export const INTELLIGENT_DISCOUNT = 0.3;
export const INTELLIGENT_OCTOPUS_URL = "https://octopusenergy.it/intelligent-octopus";

export function isOctopusConfigured(): boolean {
  return Boolean(OCTOPUS_EMAIL && OCTOPUS_PASSWORD && OCTOPUS_ACCOUNT_NUMBER);
}

// ---------------------------------------------------------------------------
// Auth (token cache a livello di modulo)
// ---------------------------------------------------------------------------

let cachedToken: string | null = null;
let cachedTokenExp = 0; // epoch ms

type GraphQLResponse<T> = { data?: T; errors?: Array<{ message: string }> };

async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  token?: string
): Promise<T> {
  const res = await fetch(OCTOPUS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: token } : {}),
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Octopus API HTTP ${res.status}`);
  }
  const json = (await res.json()) as GraphQLResponse<T>;
  if (json.errors?.length) {
    throw new Error(`Octopus GraphQL: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data) throw new Error("Octopus GraphQL: risposta senza dati");
  return json.data;
}

async function getToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExp) return cachedToken;
  if (!OCTOPUS_EMAIL || !OCTOPUS_PASSWORD) {
    throw new Error("Credenziali Octopus mancanti (OCTOPUS_EMAIL/OCTOPUS_PASSWORD)");
  }
  const data = await gql<{
    obtainKrakenToken: { token: string; refreshToken: string };
  }>(
    `mutation($email:String!,$password:String!){
      obtainKrakenToken(input:{email:$email,password:$password}){ token refreshToken }
    }`,
    { email: OCTOPUS_EMAIL, password: OCTOPUS_PASSWORD }
  );
  cachedToken = data.obtainKrakenToken.token;
  cachedTokenExp = now + 50 * 60 * 1000; // 50 min (token valido 60)
  return cachedToken;
}

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

export type OctopusTariff = {
  pod: string;
  productCode: string;
  productName: string;
  productType: string; // es. FIXED_SINGLE_RATE
  /** Materia energia €/kWh (fascia unica / F1). */
  unitRateEurPerKwh: number;
  unitRateF2: number | null;
  unitRateF3: number | null;
  /** Quota fissa €/anno. */
  annualStandingChargeEur: number;
  isSmartMeter: boolean;
  supplyStartDate: string | null;
};

export type OctopusDevice = {
  id: string;
  name: string;
  provider: string; // es. TESLA_V2
  deviceType: string; // es. ELECTRIC_VEHICLES
  typename: string; // es. SmartFlexVehicle
};

export type OctopusDispatch = {
  start: string;
  end: string;
  /** kWh dispacciati nella finestra (negativo = energia caricata). */
  deltaKwh: number;
};

export type OctopusData = {
  configured: boolean;
  accountNumber: string | null;
  tariff: OctopusTariff | null;
  device: OctopusDevice | null;
  /** Ultime finestre dall'API Kraken (finestra breve). */
  completedDispatches: OctopusDispatch[];
  /** Storico salvato in DB (ultime N finestre). */
  storedDispatches: OctopusDispatch[];
  storedDispatchCount: number;
  plannedDispatches: { start: string; end: string }[];
  /** kWh ottimizzati nelle ultime finestre API (non storico completo). */
  recentSmartKwh: number;
  recentSmartEnergyCostEur: number;
  recentIntelligentSavingEur: number;
  /** Totali mese corrente (Europe/Rome) dallo storico DB. */
  monthSmartKwh: number;
  monthSmartEnergyCostEur: number;
  monthIntelligentSavingEur: number;
  monthDispatchCount: number;
  lastSyncAt: string | null;
  dispatchDataNote: string;
};

// ---------------------------------------------------------------------------
// Query dati
// ---------------------------------------------------------------------------

async function fetchTariff(token: string): Promise<OctopusTariff | null> {
  if (!OCTOPUS_ACCOUNT_NUMBER) return null;
  const data = await gql<{
    account: {
      properties: Array<{
        electricitySupplyPoints: Array<{
          pod: string;
          status: string;
          isSmartMeter: boolean;
          supplyStartDate: string | null;
          product: {
            code: string;
            displayName: string;
            prices: {
              productType: string;
              annualStandingCharge: string | null;
              consumptionCharge: string | null;
              consumptionChargeF2: string | null;
              consumptionChargeF3: string | null;
            } | null;
          } | null;
        }> | null;
      }> | null;
    } | null;
  }>(
    `query($acc:String!){
      account(accountNumber:$acc){
        properties{
          electricitySupplyPoints{
            pod status isSmartMeter supplyStartDate
            product{ code displayName prices{
              productType annualStandingCharge consumptionCharge consumptionChargeF2 consumptionChargeF3
            } }
          }
        }
      }
    }`,
    { acc: OCTOPUS_ACCOUNT_NUMBER },
    token
  );

  const points =
    data.account?.properties?.flatMap((p) => p.electricitySupplyPoints ?? []) ?? [];
  const sp =
    points.find((p) => (OCTOPUS_POD ? p.pod === OCTOPUS_POD : true)) ?? points[0];
  if (!sp || !sp.product?.prices) return null;
  const pr = sp.product.prices;
  const num = (v: string | null) => (v == null ? null : Number(v));
  return {
    pod: sp.pod,
    productCode: sp.product.code,
    productName: sp.product.displayName,
    productType: pr.productType,
    unitRateEurPerKwh: num(pr.consumptionCharge) ?? 0,
    unitRateF2: num(pr.consumptionChargeF2),
    unitRateF3: num(pr.consumptionChargeF3),
    annualStandingChargeEur: num(pr.annualStandingCharge) ?? 0,
    isSmartMeter: sp.isSmartMeter,
    supplyStartDate: sp.supplyStartDate,
  };
}

async function fetchDevice(token: string): Promise<OctopusDevice | null> {
  if (!OCTOPUS_ACCOUNT_NUMBER) return null;
  const data = await gql<{
    devices: Array<{
      __typename: string;
      id: string;
      name: string | null;
      provider: string | null;
      deviceType: string | null;
    }> | null;
  }>(
    `query($acc:String!){
      devices(accountNumber:$acc){ __typename id name provider deviceType }
    }`,
    { acc: OCTOPUS_ACCOUNT_NUMBER },
    token
  );
  const d = data.devices?.[0];
  if (!d) return null;
  return {
    id: d.id,
    name: d.name ?? "Dispositivo",
    provider: d.provider ?? "",
    deviceType: d.deviceType ?? "",
    typename: d.__typename,
  };
}

async function fetchCompletedDispatches(token: string): Promise<OctopusDispatch[]> {
  if (!OCTOPUS_ACCOUNT_NUMBER) return [];
  const data = await gql<{
    completedDispatches: Array<{ start: string; end: string; delta: string | null }> | null;
  }>(
    `query($acc:String!){
      completedDispatches(accountNumber:$acc){ start end delta }
    }`,
    { acc: OCTOPUS_ACCOUNT_NUMBER },
    token
  );
  return (data.completedDispatches ?? []).map((d) => ({
    start: d.start,
    end: d.end,
    deltaKwh: d.delta == null ? 0 : Number(d.delta),
  }));
}

async function fetchPlannedDispatches(
  token: string,
  deviceId: string
): Promise<{ start: string; end: string }[]> {
  const data = await gql<{
    flexPlannedDispatches: Array<{ start: string; end: string }> | null;
  }>(
    `query($id:String!){ flexPlannedDispatches(deviceId:$id){ start end } }`,
    { id: deviceId },
    token
  );
  return data.flexPlannedDispatches ?? [];
}

/** Somma kWh ottimizzati deduplicando finestre (start+end). delta negativo = carica. */
export function aggregateOptimizedKwh(dispatches: OctopusDispatch[]): number {
  const byWindow = new Map<string, number>();
  for (const d of dispatches) {
    if (d.deltaKwh >= 0) continue;
    const key = `${d.start}|${d.end}`;
    const kwh = Math.abs(d.deltaKwh);
    byWindow.set(key, Math.max(byWindow.get(key) ?? 0, kwh));
  }
  return [...byWindow.values()].reduce((sum, v) => sum + v, 0);
}

// ---------------------------------------------------------------------------
// Sync storico Intelligent → DB
// ---------------------------------------------------------------------------

/** Scarica completedDispatches da Kraken e le salva in DB (upsert incrementale). */
export async function syncOctopusCompletedDispatches(): Promise<
  OctopusDispatchSyncResult & { accountNumber: string | null; unitRateEurPerKwh: number }
> {
  if (!isOctopusConfigured() || !OCTOPUS_ACCOUNT_NUMBER) {
    return { fetched: 0, upserted: 0, skipped: 0, accountNumber: null, unitRateEurPerKwh: 0 };
  }

  const token = await getToken();
  const [tariff, device, completed] = await Promise.all([
    fetchTariff(token).catch(() => null),
    fetchDevice(token).catch(() => null),
    fetchCompletedDispatches(token),
  ]);

  const unitRate = tariff?.unitRateEurPerKwh ?? 0;
  const result = await upsertOctopusDispatches(
    OCTOPUS_ACCOUNT_NUMBER,
    device?.id ?? null,
    completed,
    unitRate
  );

  return {
    ...result,
    accountNumber: OCTOPUS_ACCOUNT_NUMBER,
    unitRateEurPerKwh: unitRate,
  };
}

// ---------------------------------------------------------------------------
// Aggregato per dashboard
// ---------------------------------------------------------------------------

export async function getOctopusData(options?: { sync?: boolean }): Promise<OctopusData> {
  const empty: OctopusData = {
    configured: isOctopusConfigured(),
    accountNumber: OCTOPUS_ACCOUNT_NUMBER ?? null,
    tariff: null,
    device: null,
    completedDispatches: [],
    storedDispatches: [],
    storedDispatchCount: 0,
    plannedDispatches: [],
    recentSmartKwh: 0,
    recentSmartEnergyCostEur: 0,
    recentIntelligentSavingEur: 0,
    monthSmartKwh: 0,
    monthSmartEnergyCostEur: 0,
    monthIntelligentSavingEur: 0,
    monthDispatchCount: 0,
    lastSyncAt: null,
    dispatchDataNote:
      "Lo storico Intelligent si accumula in DB ad ogni sync (apertura dashboard o GET /api/octopus/sync). L'API Kraken espone solo le ultime finestre.",
  };
  if (!isOctopusConfigured()) return empty;

  try {
    if (options?.sync !== false) {
      await syncOctopusCompletedDispatches().catch(() => undefined);
    }

    const token = await getToken();
    const [tariff, device, completed] = await Promise.all([
      fetchTariff(token).catch(() => null),
      fetchDevice(token).catch(() => null),
      fetchCompletedDispatches(token).catch(() => []),
    ]);

    let planned: { start: string; end: string }[] = [];
    if (device) {
      planned = await fetchPlannedDispatches(token, device.id).catch(() => []);
    }

    const recentSmartKwh = aggregateOptimizedKwh(completed);
    const unitRate = tariff?.unitRateEurPerKwh ?? 0;
    const recentSmartEnergyCostEur = recentSmartKwh * unitRate;
    const recentIntelligentSavingEur = recentSmartEnergyCostEur * INTELLIGENT_DISCOUNT;

    let monthStats = {
      energyKwh: 0,
      energyCostEur: 0,
      savingEur: 0,
      dispatchCount: 0,
    };
    let storedDispatches: OctopusDispatch[] = [];
    let storedDispatchCount = 0;

    if (OCTOPUS_ACCOUNT_NUMBER) {
      [monthStats, storedDispatches, storedDispatchCount] = await Promise.all([
        getOctopusMonthStatsFromDb(OCTOPUS_ACCOUNT_NUMBER),
        getStoredOctopusDispatches(OCTOPUS_ACCOUNT_NUMBER, 20),
        countStoredOctopusDispatches(OCTOPUS_ACCOUNT_NUMBER),
      ]);
    }

    return {
      ...empty,
      tariff,
      device,
      completedDispatches: completed,
      storedDispatches,
      storedDispatchCount,
      plannedDispatches: planned,
      recentSmartKwh: Math.round(recentSmartKwh * 100) / 100,
      recentSmartEnergyCostEur: Math.round(recentSmartEnergyCostEur * 100) / 100,
      recentIntelligentSavingEur: Math.round(recentIntelligentSavingEur * 100) / 100,
      monthSmartKwh: monthStats.energyKwh,
      monthSmartEnergyCostEur: monthStats.energyCostEur,
      monthIntelligentSavingEur: monthStats.savingEur,
      monthDispatchCount: monthStats.dispatchCount,
      lastSyncAt: new Date().toISOString(),
    };
  } catch {
    return empty;
  }
}
