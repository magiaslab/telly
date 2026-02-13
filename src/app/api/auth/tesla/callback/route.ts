import { NextRequest, NextResponse } from "next/server";

/**
 * Tesla Developer può essere configurato con redirect URI
 * https://telly.codecip.it/api/auth/tesla/callback
 * ma NextAuth v5 usa /api/auth/callback/tesla.
 * Reindirizziamo qui così entrambi gli URI funzionano.
 */
export function GET(request: NextRequest) {
  const url = new URL("/api/auth/callback/tesla", request.url);
  request.nextUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

export async function POST(request: NextRequest) {
  const url = new URL("/api/auth/callback/tesla", request.url);
  const body = await request.text();
  const params = new URLSearchParams(body);
  params.forEach((value, key) => url.searchParams.set(key, value));
  return NextResponse.redirect(url, 303);
}
