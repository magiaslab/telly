import { NextRequest } from "next/server";
import { getTeslaRefreshToken } from "@/lib/tesla-refresh-token";
import { fetchTeslaAccountData } from "@/app/dashboard/data";

/**
 * GET /api/tesla/account — Profilo + veicoli + ordini Tesla.
 * Token: JWT (login con Tesla), cookie tesla_refresh_token o env.
 * Usato dalla dashboard per mostrare i dati dopo login unico Tesla.
 */
export async function GET(request: NextRequest) {
  const refreshToken = await getTeslaRefreshToken(request);
  if (!refreshToken) {
    return Response.json(
      { error: "Non autenticato con Tesla. Accedi da /login." },
      { status: 401 }
    );
  }
  const data = await fetchTeslaAccountData(refreshToken);
  if (!data) {
    return Response.json(
      { error: "Impossibile caricare i dati Tesla." },
      { status: 502 }
    );
  }
  return Response.json(data);
}
