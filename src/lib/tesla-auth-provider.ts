/**
 * Provider OAuth Tesla per NextAuth: unico login a Telly con account Tesla.
 * Token exchange su fleet-auth con audience; profilo da GET /api/1/users/me.
 */
import { customFetch } from "next-auth";
import type { OAuthConfig, OAuthUserConfig } from "next-auth/providers";

const TESLA_AUTHORIZE = "https://auth.tesla.com/oauth2/v3/authorize";
const TESLA_TOKEN_URL = "https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token";
const FLEET_AUDIENCE_NA = "https://fleet-api.prd.na.vn.cloud.tesla.com";
const FLEET_API_NA = "https://fleet-api.prd.na.vn.cloud.tesla.com";
const FLEET_API_EU = "https://fleet-api.prd.eu.vn.cloud.tesla.com";
const SCOPES =
  "openid offline_access user_data vehicle_device_data vehicle_location";

function basicAuth(clientId: string, clientSecret: string): string {
  const encoded = encodeURIComponent(clientId).replace(/%20/g, "+") + ":" + encodeURIComponent(clientSecret).replace(/%20/g, "+");
  return "Basic " + Buffer.from(encoded, "utf8").toString("base64");
}

/** Intercetta la richiesta token e inietta client_id/client_secret da process.env (fix per Vercel). */
async function teslaTokenFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith(TESLA_TOKEN_URL)) {
    return fetch(input, init);
  }
  const clientId = process.env.TESLA_CLIENT_ID;
  const clientSecret = process.env.TESLA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return fetch(input, init);
  }
  const req = input instanceof Request ? input : new Request(input, init);
  const bodyText = await req.text();
  const params = new URLSearchParams(bodyText);
  params.set("client_id", clientId);
  params.set("client_secret", clientSecret);
  const headers = new Headers(req.headers);
  headers.set("Authorization", basicAuth(clientId, clientSecret));
  headers.set("Content-Type", "application/x-www-form-urlencoded");
  return fetch(url, {
    method: req.method,
    headers,
    body: params.toString(),
  });
}

export interface TeslaProfile {
  id: number;
  email?: string;
  full_name?: string;
  profile_image_url?: string;
}

export default function Tesla(
  options: OAuthUserConfig<TeslaProfile>
): OAuthConfig<TeslaProfile> {
  const { clientId: _cid, clientSecret: _csec, ...restOptions } = options;
  return {
    id: "tesla",
    name: "Tesla",
    type: "oauth",
    authorization: {
      url: TESLA_AUTHORIZE,
      params: {
        scope: SCOPES,
        response_type: "code",
      },
    },
    token: {
      url: TESLA_TOKEN_URL,
      async request({
        params,
        provider,
      }: {
        params: { code?: string };
        provider: { clientId?: string; clientSecret?: string; callbackUrl: string };
      }) {
        // Leggi a runtime da process.env (su Vercel il provider può essere inizializzato senza env)
        const clientId = process.env.TESLA_CLIENT_ID ?? provider.clientId;
        const clientSecret = process.env.TESLA_CLIENT_SECRET ?? provider.clientSecret;
        const redirectUri = provider.callbackUrl;
        if (!clientId || !clientSecret || !redirectUri) {
          const msg = "Tesla OAuth: missing clientId, clientSecret or callbackUrl";
          console.error("[Telly Tesla OAuth]", msg, { hasClientId: !!clientId, hasClientSecret: !!clientSecret, redirectUri: redirectUri ?? null });
          throw new Error(msg);
        }
        const body = new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          code: params.code as string,
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
          const msg = `Tesla token exchange failed: ${res.status} ${text}`;
          console.error("[Telly Tesla OAuth]", msg);
          throw new Error(msg);
        }
        const data = (await res.json()) as {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
        };
        return {
          tokens: {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_in: data.expires_in,
          },
        };
      },
    },
    userinfo: {
      url: `${FLEET_API_NA}/api/1/users/me`,
      async request({
        tokens,
      }: {
        tokens: { access_token?: string };
      }) {
        const authHeader = `Bearer ${tokens.access_token ?? ""}`;
        const tryUserinfo = async (base: string) => {
          const r = await fetch(`${base}/api/1/users/me`, {
            headers: { Authorization: authHeader, "Content-Type": "application/json" },
          });
          return { ok: r.ok, status: r.status, json: r.ok ? await r.json() : null };
        };
        let out = await tryUserinfo(FLEET_API_NA);
        if (!out.ok && (out.status === 401 || out.status === 403)) {
          out = await tryUserinfo(FLEET_API_EU);
        }
        if (!out.ok) {
          const msg = `Tesla userinfo failed: ${out.status} (NA e EU provati)`;
          console.error("[Telly Tesla OAuth]", msg);
          throw new Error(msg);
        }
        const json = out.json as { response?: TeslaProfile };
        return json?.response ?? json;
      },
    },
    profile(profile: TeslaProfile) {
      return {
        id: String(profile.id),
        email: profile.email ?? undefined,
        name: profile.full_name ?? undefined,
        image: profile.profile_image_url ?? undefined,
      };
    },
    style: { brandColor: "#cc0000" },
    ...restOptions,
    get clientId() {
      return process.env.TESLA_CLIENT_ID ?? options.clientId ?? "";
    },
    get clientSecret() {
      return process.env.TESLA_CLIENT_SECRET ?? options.clientSecret ?? "";
    },
    [customFetch]: teslaTokenFetch,
  } as OAuthConfig<TeslaProfile>;
}
