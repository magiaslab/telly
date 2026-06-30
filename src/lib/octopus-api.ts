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
  completedDispatches: OctopusDispatch[];
  plannedDispatches: { start: string; end: string }[];
  /**
   * kWh ottimizzati nelle finestre Intelligent restituite dall'API (finestra breve, non mese intero).
   * L'app Octopus mostra il totale in bolletta; qui abbiamo solo gli ultimi dispatch Kraken.
   */
  recentSmartKwh: number;
  recentSmartEnergyCostEur: number;
  recentIntelligentSavingEur: number;
  /** @deprecated usa recentSmartKwh */
  monthSmartKwh: number;
  monthSmartEnergyCostEur: number;
  monthIntelligentSavingEur: number;
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
function aggregateOptimizedKwh(dispatches: OctopusDispatch[]): number {
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
// Aggregato per dashboard
// ---------------------------------------------------------------------------

export async function getOctopusData(): Promise<OctopusData> {
  const empty: OctopusData = {
    configured: isOctopusConfigured(),
    accountNumber: OCTOPUS_ACCOUNT_NUMBER ?? null,
    tariff: null,
    device: null,
    completedDispatches: [],
    plannedDispatches: [],
    recentSmartKwh: 0,
    recentSmartEnergyCostEur: 0,
    recentIntelligentSavingEur: 0,
    monthSmartKwh: 0,
    monthSmartEnergyCostEur: 0,
    monthIntelligentSavingEur: 0,
    dispatchDataNote:
      "L'API Kraken espone solo le ultime finestre Intelligent completate (non il mese intero). Il totale in bolletta è nell'app Octopus.",
  };
  if (!isOctopusConfigured()) return empty;

  try {
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

    // API completedDispatches: finestre recenti (non storico mensile completo).
    const recentSmartKwh = aggregateOptimizedKwh(completed);

    const unitRate = tariff?.unitRateEurPerKwh ?? 0;
    const recentSmartEnergyCostEur = recentSmartKwh * unitRate;
    const recentIntelligentSavingEur = recentSmartEnergyCostEur * INTELLIGENT_DISCOUNT;

    return {
      ...empty,
      tariff,
      device,
      completedDispatches: completed,
      plannedDispatches: planned,
      recentSmartKwh: Math.round(recentSmartKwh * 100) / 100,
      recentSmartEnergyCostEur: Math.round(recentSmartEnergyCostEur * 100) / 100,
      recentIntelligentSavingEur: Math.round(recentIntelligentSavingEur * 100) / 100,
      monthSmartKwh: Math.round(recentSmartKwh * 100) / 100,
      monthSmartEnergyCostEur: Math.round(recentSmartEnergyCostEur * 100) / 100,
      monthIntelligentSavingEur: Math.round(recentIntelligentSavingEur * 100) / 100,
      dispatchDataNote: empty.dispatchDataNote,
    };
  } catch {
    return empty;
  }
}
