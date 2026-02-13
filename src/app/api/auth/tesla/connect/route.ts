import { NextRequest } from "next/server";
import { cookies } from "next/headers";

const TESLA_AUTHORIZE = "https://auth.tesla.com/oauth2/v3/authorize";
const SCOPES =
  "openid offline_access user_data vehicle_device_data vehicle_location";
const STATE_COOKIE = "tesla_oauth_state";
const STATE_MAX_AGE = 60 * 10; // 10 minuti

/**
 * GET /api/auth/tesla/connect
 * Reindirizza l'utente a Tesla OAuth. Salva state in cookie per CSRF.
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.TESLA_CLIENT_ID;
  const redirectUri = process.env.TESLA_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return Response.json(
      {
        error:
          "Configurazione mancante: imposta TESLA_CLIENT_ID e TESLA_REDIRECT_URI in .env",
      },
      { status: 500 }
    );
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: STATE_MAX_AGE,
    path: "/",
  });

  const url = new URL(TESLA_AUTHORIZE);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);

  return Response.redirect(url.toString());
}
