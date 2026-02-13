import { NextRequest } from "next/server";
import { cookies } from "next/headers";

const TESLA_TOKEN_URL = "https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token";
const FLEET_AUDIENCE_NA = "https://fleet-api.prd.na.vn.cloud.tesla.com";
const STATE_COOKIE = "tesla_oauth_state";
const REFRESH_COOKIE = "tesla_refresh_token";
const REFRESH_COOKIE_MAX_AGE = 90 * 24 * 60 * 60; // 90 giorni (Tesla: refresh scade dopo 3 mesi, teniamo 90 giorni)

/**
 * GET /api/auth/tesla/callback
 * Tesla reindirizza qui con ?code=...&state=...
 * Scambia code con refresh_token, salva in cookie, redirect a /dashboard.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  const dashboardUrl = new URL("/dashboard", request.nextUrl.origin);

  if (errorParam) {
    dashboardUrl.searchParams.set("tesla_error", errorParam);
    return Response.redirect(dashboardUrl.toString());
  }

  if (!code || !state) {
    dashboardUrl.searchParams.set("tesla_error", "missing_code_or_state");
    return Response.redirect(dashboardUrl.toString());
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get(STATE_COOKIE)?.value;
  if (!savedState || savedState !== state) {
    dashboardUrl.searchParams.set("tesla_error", "invalid_state");
    return Response.redirect(dashboardUrl.toString());
  }

  cookieStore.delete(STATE_COOKIE);

  const clientId = process.env.TESLA_CLIENT_ID;
  const clientSecret = process.env.TESLA_CLIENT_SECRET;
  const redirectUri = process.env.TESLA_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    dashboardUrl.searchParams.set("tesla_error", "server_config");
    return Response.redirect(dashboardUrl.toString());
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    audience: FLEET_AUDIENCE_NA,
  });

  const res = await fetch(TESLA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    dashboardUrl.searchParams.set("tesla_error", "token_exchange_failed");
    return Response.redirect(dashboardUrl.toString());
  }

  type TokenRes = { refresh_token?: string };
  const data = (await res.json()) as TokenRes;
  const refreshToken = data.refresh_token;

  if (!refreshToken) {
    dashboardUrl.searchParams.set("tesla_error", "no_refresh_token");
    return Response.redirect(dashboardUrl.toString());
  }

  cookieStore.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: REFRESH_COOKIE_MAX_AGE,
    path: "/",
  });

  return Response.redirect(dashboardUrl.toString());
}
