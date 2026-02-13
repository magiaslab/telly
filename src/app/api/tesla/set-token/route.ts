import { NextRequest } from "next/server";
import { auth } from "@/auth";

const COOKIE_NAME = "tesla_refresh_token";
const MAX_AGE = 365 * 24 * 60 * 60; // 1 anno

/**
 * POST: salva il refresh token Tesla in un cookie (solo utenti autenticati).
 * Alternativa quando auth.tesla.com restituisce Access Denied: ottieni il token
 * altrove (es. script locale) e incollalo qui.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Non autenticato" }, { status: 401 });
  }

  let body: { refreshToken?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON non valido" }, { status: 400 });
  }

  const token = typeof body.refreshToken === "string" ? body.refreshToken.trim() : "";
  if (!token || token.length < 20) {
    return Response.json(
      { error: "refreshToken mancante o troppo corto" },
      { status: 400 }
    );
  }

  const isProd = process.env.NODE_ENV === "production";
  const cookie = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${MAX_AGE}`,
    ...(isProd ? ["Secure"] : []),
  ].join("; ");

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie,
    },
  });
}
