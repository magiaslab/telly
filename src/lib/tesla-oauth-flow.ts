/**
 * OAuth Tesla Fleet API — Third-Party Tokens
 * @see https://developer.tesla.com/docs/fleet-api/authentication/third-party-tokens
 *
 * Flusso custom (non NextAuth signin/tesla) per evitare Referer verso auth.tesla.com
 * che Akamai blocca con Access Denied.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { encode } from "next-auth/jwt";
import { db } from "@/db";
import { users, accounts } from "@/db/schema";

const TESLA_AUTHORIZE = "https://auth.tesla.com/oauth2/v3/authorize";
const TESLA_TOKEN_URL = "https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token";
const FLEET_API_EU = "https://fleet-api.prd.eu.vn.cloud.tesla.com";
const FLEET_API_NA = "https://fleet-api.prd.na.vn.cloud.tesla.com";
const FLEET_AUDIENCE_EU = "https://fleet-api.prd.eu.vn.cloud.tesla.com";
const FLEET_AUDIENCE_NA = "https://fleet-api.prd.na.vn.cloud.tesla.com";

export const TESLA_OAUTH_SCOPES =
  "openid offline_access user_data email profile vehicle_device_data vehicle_location";

const TESLA_USERINFO_URL = "https://auth.tesla.com/oauth2/v3/userinfo";

export const STATE_COOKIE = "tesla_oauth_nonce";
const STATE_TTL_MS = 10 * 60 * 1000;

export type TeslaOAuthState = {
  callbackUrl: string;
  nonce: string;
  exp: number;
};

export type TeslaTokenResult = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  id_token?: string;
  /** Base Fleet API usata per l'audience del token. */
  fleetBaseUrl: string;
};

export type TeslaUserProfile = {
  /** ID numerico Tesla (users/me) o derivato stabile dal sub OpenID. */
  id: number;
  /** Identificatore account OAuth (sub o id stringa). */
  subject: string;
  email?: string;
  full_name?: string;
  profile_image_url?: string;
};

export function getTeslaRedirectUri(): string {
  const fromEnv = process.env.TESLA_REDIRECT_URI?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const base =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return `${base}/api/auth/callback/tesla`;
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET mancante");
  return secret;
}

function signState(payload: TeslaOAuthState): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", getAuthSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyState(state: string): TeslaOAuthState | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", getAuthSecret()).update(body).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TeslaOAuthState;
    if (!parsed.nonce || !parsed.callbackUrl || !parsed.exp) return null;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function safeCallbackUrl(raw: string | null | undefined): string {
  const value = (raw ?? "/dashboard").trim();
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

/** Prepara state firmato + cookie nonce per il callback. */
export async function prepareTeslaOAuth(callbackUrl: string): Promise<{
  authorizeUrl: string;
  state: string;
}> {
  const clientId = process.env.TESLA_CLIENT_ID;
  if (!clientId) throw new Error("TESLA_CLIENT_ID mancante");

  const nonce = randomBytes(16).toString("hex");
  const payload: TeslaOAuthState = {
    callbackUrl: safeCallbackUrl(callbackUrl),
    nonce,
    exp: Date.now() + STATE_TTL_MS,
  };
  const state = signState(payload);

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_MS / 1000,
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: getTeslaRedirectUri(),
    scope: TESLA_OAUTH_SCOPES,
    state,
    locale: "it-IT",
    prompt: "login",
    prompt_missing_scopes: "true",
  });

  return {
    state,
    authorizeUrl: `${TESLA_AUTHORIZE}?${params.toString()}`,
  };
}

export function validateOAuthState(state: string, nonceFromCookie: string | undefined): TeslaOAuthState | null {
  const parsed = verifyState(state);
  if (!parsed || !nonceFromCookie) return null;
  if (parsed.nonce !== nonceFromCookie) return null;
  return parsed;
}

async function exchangeCode(code: string, audience: string): Promise<TeslaTokenResult> {
  const clientId = process.env.TESLA_CLIENT_ID;
  const clientSecret = process.env.TESLA_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Credenziali Tesla OAuth mancanti");

  const fleetBaseUrl =
    audience === FLEET_AUDIENCE_EU ? FLEET_API_EU : FLEET_API_NA;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: getTeslaRedirectUri(),
    audience,
    scope: TESLA_OAUTH_SCOPES,
  });

  const res = await fetch(TESLA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`token_exchange_failed:${res.status}:${text}`);
  }
  const data = (await res.json()) as TeslaTokenResult & {
    refresh_token?: string;
    id_token?: string;
  };
  if (!data.access_token || !data.refresh_token) {
    throw new Error("no_refresh_token");
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    id_token: data.id_token,
    fleetBaseUrl,
  };
}

export async function exchangeAuthorizationCode(code: string): Promise<TeslaTokenResult> {
  const preferred =
    process.env.TESLA_FLEET_REGION?.toUpperCase() === "NA"
      ? FLEET_AUDIENCE_NA
      : FLEET_AUDIENCE_EU;
  const fallback = preferred === FLEET_AUDIENCE_EU ? FLEET_AUDIENCE_NA : FLEET_AUDIENCE_EU;
  try {
    return await exchangeCode(code, preferred);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("invalid_auth_code")) throw e;
    return await exchangeCode(code, fallback);
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function stableNumericId(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (Math.imul(31, h) + key.charCodeAt(i)) >>> 0;
  }
  return h || 1;
}

function profileFromJwtPayload(
  payload: Record<string, unknown>,
  source: string
): TeslaUserProfile | null {
  const sub = payload.sub;
  if (sub == null) return null;
  const subject = String(sub);
  const id = /^\d+$/.test(subject) ? Number(subject) : stableNumericId(subject);
  const email = typeof payload.email === "string" ? payload.email : undefined;
  const name =
    typeof payload.name === "string"
      ? payload.name
      : typeof payload.full_name === "string"
        ? payload.full_name
        : undefined;
  const picture = typeof payload.picture === "string" ? payload.picture : undefined;
  if (!email && !name && source === "access_token") return null;
  return {
    id,
    subject,
    email,
    full_name: name,
    profile_image_url: picture,
  };
}

async function fetchOpenIdUserInfo(accessToken: string): Promise<TeslaUserProfile | null> {
  const res = await fetch(TESLA_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as Record<string, unknown>;
  return profileFromJwtPayload(json, "userinfo");
}

async function fetchUserMe(
  accessToken: string,
  baseUrl: string
): Promise<{ profile: TeslaUserProfile | null; status: number }> {
  const res = await fetch(`${baseUrl}/api/1/users/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) return { profile: null, status: res.status };
  const json = (await res.json()) as {
    response?: { id: number; email?: string; full_name?: string; profile_image_url?: string };
  };
  const r = json.response;
  if (!r?.id) return { profile: null, status: res.status };
  return {
    profile: {
      id: r.id,
      subject: String(r.id),
      email: r.email,
      full_name: r.full_name,
      profile_image_url: r.profile_image_url,
    },
    status: res.status,
  };
}

async function detectFleetBaseUrl(accessToken: string): Promise<string | null> {
  for (const base of [FLEET_API_EU, FLEET_API_NA]) {
    const res = await fetch(`${base}/api/1/region`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) continue;
    const json = (await res.json()) as { response?: { region?: string } };
    const region = json.response?.region;
    if (region === "EU") return FLEET_API_EU;
    if (region === "NA") return FLEET_API_NA;
    return base;
  }
  return null;
}

export async function fetchTeslaUserProfile(
  tokens: TeslaTokenResult
): Promise<TeslaUserProfile> {
  const errors: string[] = [];

  if (tokens.id_token) {
    const payload = decodeJwtPayload(tokens.id_token);
    if (payload) {
      const fromId = profileFromJwtPayload(payload, "id_token");
      if (fromId?.email || fromId?.full_name) return fromId;
      if (fromId) errors.push("id_token:no_email");
    }
  }

  const fromUserinfo = await fetchOpenIdUserInfo(tokens.access_token);
  if (fromUserinfo?.email || fromUserinfo?.full_name) return fromUserinfo;
  if (fromUserinfo) errors.push("userinfo:minimal");

  const accessPayload = decodeJwtPayload(tokens.access_token);
  if (accessPayload) {
    const fromAccess = profileFromJwtPayload(accessPayload, "access_token");
    if (fromAccess?.email) return fromAccess;
  }

  const detected = await detectFleetBaseUrl(tokens.access_token);
  const uniqueBases = [...new Set([tokens.fleetBaseUrl, detected].filter(Boolean))] as string[];

  for (const base of uniqueBases) {
    const { profile, status } = await fetchUserMe(tokens.access_token, base);
    if (profile) return profile;
    errors.push(`users/me:${base}:${status}`);
  }

  if (fromUserinfo) return fromUserinfo;
  if (tokens.id_token) {
    const payload = decodeJwtPayload(tokens.id_token);
    if (payload) {
      const fromId = profileFromJwtPayload(payload, "id_token");
      if (fromId) return fromId;
    }
  }
  if (accessPayload) {
    const fromAccess = profileFromJwtPayload(accessPayload, "access_token");
    if (fromAccess) return fromAccess;
  }

  throw new Error(`userinfo_failed:${errors.join("|") || "no_profile_source"}`);
}

async function resolveOrCreateUser(profile: TeslaUserProfile): Promise<{ id: string; email: string }> {
  const email =
    profile.email?.trim().toLowerCase() ||
    `tesla-${profile.id}@users.telly.local`;

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    await db
      .update(users)
      .set({
        name: profile.full_name ?? existing.name,
        image: profile.profile_image_url ?? existing.image,
      })
      .where(eq(users.id, existing.id));
    return { id: existing.id, email };
  }

  const [created] = await db
    .insert(users)
    .values({
      email,
      name: profile.full_name ?? null,
      image: profile.profile_image_url ?? null,
    })
    .returning({ id: users.id, email: users.email });
  return { id: created.id, email: created.email };
}

async function upsertTeslaAccount(
  userId: string,
  profile: TeslaUserProfile,
  tokens: TeslaTokenResult
) {
  const providerAccountId = profile.subject;
  const row = {
    userId,
    type: "oauth" as const,
    provider: "tesla",
    providerAccountId,
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
    expires_at: tokens.expires_in
      ? Math.floor(Date.now() / 1000) + tokens.expires_in
      : null,
    token_type: "Bearer",
    scope: TESLA_OAUTH_SCOPES,
  };

  const [existing] = await db
    .select()
    .from(accounts)
    .where(
      and(eq(accounts.provider, "tesla"), eq(accounts.providerAccountId, providerAccountId))
    )
    .limit(1);

  if (existing) {
    await db
      .update(accounts)
      .set({
        userId,
        refresh_token: row.refresh_token,
        access_token: row.access_token,
        expires_at: row.expires_at,
      })
      .where(
        and(eq(accounts.provider, "tesla"), eq(accounts.providerAccountId, providerAccountId))
      );
  } else {
    await db.insert(accounts).values(row);
  }
}

function sessionCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
}

export async function createNextAuthSessionCookie(
  user: { id: string; email: string; name?: string | null; image?: string | null },
  refreshToken: string
): Promise<string> {
  const maxAge = 30 * 24 * 60 * 60;
  return encode({
    token: {
      sub: user.id,
      email: user.email,
      name: user.name ?? undefined,
      picture: user.image ?? undefined,
      tesla_refresh_token: refreshToken,
    },
    secret: getAuthSecret(),
    salt: sessionCookieName(),
    maxAge,
  });
}

export async function completeTeslaOAuth(params: {
  code: string;
  state: string;
  nonceFromCookie?: string;
}): Promise<{ redirectTo: string; sessionToken: string; refreshToken: string }> {
  const oauthState = validateOAuthState(params.state, params.nonceFromCookie);
  if (!oauthState) throw new Error("invalid_state");

  const tokens = await exchangeAuthorizationCode(params.code);
  const profile = await fetchTeslaUserProfile(tokens);
  const user = await resolveOrCreateUser(profile);
  await upsertTeslaAccount(user.id, profile, tokens);

  const sessionToken = await createNextAuthSessionCookie(
    {
      id: user.id,
      email: user.email,
      name: profile.full_name,
      image: profile.profile_image_url,
    },
    tokens.refresh_token
  );

  const cookieStore = await cookies();
  cookieStore.delete(STATE_COOKIE);

  return {
    redirectTo: oauthState.callbackUrl,
    sessionToken,
    refreshToken: tokens.refresh_token,
  };
}
