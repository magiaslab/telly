import { cookies } from "next/headers";
import {
  getTeslaAccessToken,
  getTeslaRegion,
  listVehicles,
  getTeslaFleetBaseUrl,
} from "@/lib/tesla-api";

/**
 * GET /api/tesla/vehicles — Lista veicoli Tesla dell'account (senza VIN in input).
 * Token: cookie tesla_refresh_token o env TESLA_REFRESH_TOKEN.
 * Restituisce id, vin, display_name, state per ogni veicolo.
 */
export async function GET() {
  const cookieStore = await cookies();
  const refreshToken =
    cookieStore.get("tesla_refresh_token")?.value ?? process.env.TESLA_REFRESH_TOKEN;

  if (!refreshToken) {
    return Response.json(
      {
        error:
          "Missing Tesla refresh token (cookie tesla_refresh_token or env TESLA_REFRESH_TOKEN)",
      },
      { status: 401 }
    );
  }

  let accessToken: string;
  try {
    accessToken = await getTeslaAccessToken(refreshToken);
  } catch (e) {
    return Response.json(
      { error: "Tesla token refresh failed", details: String(e) },
      { status: 401 }
    );
  }

  try {
    const regionRes = await getTeslaRegion(accessToken);
    const region = regionRes.response?.region ?? "NA";
    const baseUrl = getTeslaFleetBaseUrl(region === "EU" ? "EU" : "NA");

    const vehiclesRes = await listVehicles(accessToken, baseUrl);

    return Response.json({
      vehicles: vehiclesRes.response ?? [],
      count: vehiclesRes.count ?? 0,
    });
  } catch (e) {
    return Response.json(
      { error: "Tesla vehicles list failed", details: String(e) },
      { status: 502 }
    );
  }
}
