import { NextRequest } from "next/server";
import {
  getTeslaAccessToken,
  getTeslaRegion,
  listVehicles,
  getTeslaFleetBaseUrl,
} from "@/lib/tesla-api";
import { getTeslaRefreshToken } from "@/lib/tesla-refresh-token";

/**
 * GET /api/tesla/vehicles — Lista veicoli Tesla (senza VIN in input).
 * Token: JWT (login Tesla), cookie o env.
 */
export async function GET(request: NextRequest) {
  const refreshToken = await getTeslaRefreshToken(request);

  if (!refreshToken) {
    return Response.json(
      { error: "Accedi con Tesla da /login." },
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
