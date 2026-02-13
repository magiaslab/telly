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
const TESLA_AUTH_BASE = "https://auth.tesla.com/oauth2/v3";

export async function getTeslaAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(`${TESLA_AUTH_BASE}/token`, {
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

export async function getVehicleData(
  accessToken: string,
  vin: string
): Promise<TeslaVehicleDataValidated | null> {
  const url = `${TESLA_API_BASE}/api/1/vehicles/${encodeURIComponent(vin)}/vehicle_data`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    next: { revalidate: 0 },
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
