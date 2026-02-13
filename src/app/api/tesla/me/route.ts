import { NextRequest } from "next/server";
import {
  getTeslaAccessToken,
  getTeslaRegion,
  getTeslaUserMe,
  getTeslaFleetBaseUrl,
} from "@/lib/tesla-api";
import { getTeslaRefreshToken } from "@/lib/tesla-refresh-token";

/**
 * GET /api/tesla/me — Profilo utente Tesla + regione (senza VIN).
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

    const meRes = await getTeslaUserMe(accessToken, baseUrl);

    return Response.json({
      user: meRes.response,
      region,
    });
  } catch (e) {
    return Response.json(
      { error: "Tesla users/me or region failed", details: String(e) },
      { status: 502 }
    );
  }
}
