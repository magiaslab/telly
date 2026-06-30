import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

/**
 * Restituisce il refresh token Tesla da: JWT (login con Tesla), cookie (legacy), o env.
 * Usare nelle API route passando la request.
 */
export async function getTeslaRefreshToken(
  request?: NextRequest
): Promise<string | null> {
  if (request) {
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: process.env.NODE_ENV === "production",
      cookieName:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
    });
    if (token?.tesla_refresh_token && typeof token.tesla_refresh_token === "string") {
      return token.tesla_refresh_token;
    }
  }
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get("tesla_refresh_token")?.value;
  if (fromCookie) return fromCookie;
  return process.env.TESLA_REFRESH_TOKEN ?? null;
}
