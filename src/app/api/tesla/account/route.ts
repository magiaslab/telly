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
      { error: "Non autenticato con Tesla. Accedi da /login o collega dalla dashboard." },
      { status: 401 }
    );
  }
  try {
    const data = await fetchTeslaAccountData(refreshToken);
    return Response.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isTokenInvalid =
      msg.includes("401") ||
      msg.includes("login_required") ||
      msg.includes("token refresh failed");
    if (isTokenInvalid) {
      return Response.json(
        {
          error:
            "Token Tesla scaduto o non valido. Ricollegare l'account dalla dashboard o incollare un nuovo token.",
        },
        { status: 401 }
      );
    }
    return Response.json(
      { error: "Impossibile caricare i dati Tesla." },
      { status: 502 }
    );
  }
}
