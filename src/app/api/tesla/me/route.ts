import { cookies } from "next/headers";
import {
  getTeslaAccessToken,
  getTeslaRegion,
  getTeslaUserMe,
  getTeslaFleetBaseUrl,
} from "@/lib/tesla-api";

/**
 * GET /api/tesla/me — Profilo utente Tesla + regione (senza VIN).
 * Token: cookie tesla_refresh_token o env TESLA_REFRESH_TOKEN.
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
