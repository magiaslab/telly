import { teslaVehicleDataSchema } from "./tesla-vehicle-data.zod";
import type { TeslaVehicleDataValidated } from "./tesla-vehicle-data.zod";
import type { TeslaTokenResponse, TeslaVehiclesResponse } from "./tesla-types";

const TESLA_API_BASE = "https://fleet-api.prd.na.vn.cloud.tesla.com";
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

export async function listVehicles(accessToken: string): Promise<TeslaVehiclesResponse> {
  const res = await fetch(`${TESLA_API_BASE}/api/1/vehicles`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Tesla vehicles list failed: ${res.status}`);
  return res.json();
}
