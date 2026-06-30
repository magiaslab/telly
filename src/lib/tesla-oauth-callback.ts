import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { completeTeslaOAuth, STATE_COOKIE } from "@/lib/tesla-oauth-flow";

function sessionCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
}

const ERROR_MAP: Record<string, string> = {
  token_exchange_failed: "token_exchange_failed",
  no_refresh_token: "no_refresh_token",
  invalid_state: "invalid_state",
  userinfo_failed: "userinfo_failed",
};

/** Gestisce il callback OAuth Tesla (code + state) e crea la sessione NextAuth. */
export async function handleTeslaOAuthCallback(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl;
  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      new URL(`/auth-error?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/auth-error?error=missing_code_or_state", request.url)
    );
  }

  const cookieStore = await cookies();
  const nonce = cookieStore.get("tesla_oauth_nonce")?.value;

  try {
    const { redirectTo, sessionToken, refreshToken } = await completeTeslaOAuth({
      code,
      state,
      nonceFromCookie: nonce,
    });

    const dest = new URL(redirectTo, request.url);
    if (dest.pathname === "/dashboard" && !dest.search) {
      dest.searchParams.set("tesla_linked", "1");
    }

    const res = NextResponse.redirect(dest);
    const isProd = process.env.NODE_ENV === "production";
    const maxAge = 30 * 24 * 60 * 60;

    res.cookies.set(sessionCookieName(), sessionToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    res.cookies.set("tesla_refresh_token", refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });

    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (e) {
    const raw = e instanceof Error ? e.message : "token_exchange_failed";
    const key = Object.keys(ERROR_MAP).find((k) => raw.includes(k)) ?? "token_exchange_failed";
    const mapped = ERROR_MAP[key] ?? "token_exchange_failed";
    return NextResponse.redirect(
      new URL(
        `/auth-error?error=${mapped}&error_description=${encodeURIComponent(raw)}`,
        request.url
      )
    );
  }
}
