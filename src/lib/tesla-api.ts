import { teslaVehicleDataSchema } from "./tesla-vehicle-data.zod";
import type { TeslaVehicleDataValidated } from "./tesla-vehicle-data.zod";
import type {
  TeslaTokenResponse,
  TeslaVehiclesResponse,
  TeslaUserMeResponse,
  TeslaRegionResponse,
  TeslaOrdersResponse,
} from "./tesla-types";

const TESLA_API_BASE_NA = "https://fleet-api.prd.na.vn.cloud.tesla.com";
const TESLA_API_BASE_EU = "https://fleet-api.prd.eu.vn.cloud.tesla.com";
/** Base URL Fleet API per regione (NA = Americas/APAC, EU = Europa/MEA) */
export function getTeslaFleetBaseUrl(region: "NA" | "EU" = "NA"): string {
  return region === "EU" ? TESLA_API_BASE_EU : TESLA_API_BASE_NA;
}

const TESLA_API_BASE = TESLA_API_BASE_NA;
/** Token endpoint: secondo la guida Tesla va usato fleet-auth per code exchange e refresh. */
const TESLA_TOKEN_URL = "https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token";
const MILES_TO_KM = 1.60934;

/** Endpoint espliciti: da firmware 2023.38+ serve location_data per lat/lon a veicolo fermo. */
const VEHICLE_DATA_ENDPOINTS =
  "charge_state;climate_state;drive_state;vehicle_state;location_data;gui_settings";

/** Risolve la base Fleet API (EU per account europei). */
export async function resolveFleetBaseUrl(accessToken: string): Promise<string> {
  const forced = process.env.TESLA_FLEET_REGION?.toUpperCase();
  if (forced === "EU") return TESLA_API_BASE_EU;
  if (forced === "NA") return TESLA_API_BASE_NA;

  for (const base of [TESLA_API_BASE_EU, TESLA_API_BASE_NA]) {
    try {
      const regionRes = await getTeslaRegion(accessToken, base);
      const region = regionRes.response?.region;
      if (region === "EU") return TESLA_API_BASE_EU;
      if (region === "NA") return TESLA_API_BASE_NA;
      return base;
    } catch {
      // prova l'altra regione
    }
  }
  return TESLA_API_BASE_EU;
}

export async function getTeslaAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(TESLA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.TESLA_CLIENT_ID!,
      client_secret: process.env.TESLA_CLIENT_SECRET!,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tesla token refresh failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as TeslaTokenResponse;
  return data.access_token;
}

export type TelemetryFromVehicle = {
  soc: number;
  odometerKm: number;
  rangeKm: number;
  isCharging: boolean;
  powerUsage: number | null;
  tempInside: number | null;
  lat: number | null;
  lon: number | null;
};

/** Mappa vehicle_data Fleet API → valori metrici per il DB (km, lat/lon). */
export function mapVehicleDataToTelemetry(data: TeslaVehicleDataValidated): TelemetryFromVehicle {
  const charge = data.charge_state;
  const drive = data.drive_state;
  const vehicle = data.vehicle_state;
  const climate = data.climate_state;
  const location = data.location_data;

  const distanceUnits = data.gui_settings?.distance_units;
  const odometerRaw = vehicle?.odometer ?? 0;
  const odometerKm =
    distanceUnits === "km" ? odometerRaw : odometerRaw * MILES_TO_KM;

  const rangeMiles = charge?.battery_range ?? 0;
  const rangeKm = rangeMiles * MILES_TO_KM;

  const lat = drive?.latitude ?? location?.latitude ?? null;
  const lon = drive?.longitude ?? location?.longitude ?? null;

  return {
    soc: charge?.battery_level ?? 0,
    odometerKm: Math.round(odometerKm * 10) / 10,
    rangeKm: Math.round(rangeKm * 10) / 10,
    isCharging: (charge?.charging_state ?? "") === "Charging",
    powerUsage: charge?.charger_power ?? drive?.power ?? null,
    tempInside: climate?.inside_temp ?? null,
    lat,
    lon,
  };
}

export async function getVehicleData(
  accessToken: string,
  vin: string,
  fleetBaseUrl?: string
): Promise<TeslaVehicleDataValidated | null> {
  const base = fleetBaseUrl ?? (await resolveFleetBaseUrl(accessToken));
  const params = new URLSearchParams({ endpoints: VEHICLE_DATA_ENDPOINTS });
  const url = `${base}/api/1/vehicles/${encodeURIComponent(vin)}/vehicle_data?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    if (res.status === 408 || res.status === 504) {
      return null; // vehicle asleep / timeout
    }
    const text = await res.text();
    throw new Error(`Tesla vehicle_data failed: ${res.status} ${text}`);
  }
  const raw = await res.json();
  const parsed = teslaVehicleDataSchema.safeParse(raw.response ?? raw);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

export async function wakeVehicle(
  accessToken: string,
  vin: string,
  fleetBaseUrl: string
): Promise<boolean> {
  const res = await fetch(
    `${fleetBaseUrl}/api/1/vehicles/${encodeURIComponent(vin)}/wake_up`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );
  return res.ok;
}

export async function listVehicles(
  accessToken: string,
  baseUrl: string = TESLA_API_BASE
): Promise<TeslaVehiclesResponse> {
  const res = await fetch(`${baseUrl}/api/1/vehicles`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Tesla vehicles list failed: ${res.status}`);
  return res.json();
}

/**
 * GET /api/1/users/me — profilo utente Tesla (senza VIN).
 * Richiede token con scope user_data o openid.
 */
export async function getTeslaUserMe(
  accessToken: string,
  baseUrl: string = TESLA_API_BASE
): Promise<TeslaUserMeResponse> {
  const res = await fetch(`${baseUrl}/api/1/users/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Tesla users/me failed: ${res.status}`);
  return res.json();
}

/**
 * GET /api/1/region — regione dell'account (NA / EU / CN). Senza VIN.
 * Usa la base per scegliere l'endpoint Fleet corretto (getTeslaFleetBaseUrl).
 */
export async function getTeslaRegion(
  accessToken: string,
  baseUrl: string = TESLA_API_BASE
): Promise<TeslaRegionResponse> {
  const res = await fetch(`${baseUrl}/api/1/region`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Tesla region failed: ${res.status}`);
  return res.json();
}

/**
 * GET /api/1/users/orders — ordini attivi dell'utente (senza VIN).
 * Documentazione: "Returns the active orders for a user". Forma esatta non documentata.
 */
export async function getTeslaOrders(
  accessToken: string,
  baseUrl: string = TESLA_API_BASE
): Promise<TeslaOrdersResponse> {
  const res = await fetch(`${baseUrl}/api/1/users/orders`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Tesla users/orders failed: ${res.status}`);
  return res.json();
}
