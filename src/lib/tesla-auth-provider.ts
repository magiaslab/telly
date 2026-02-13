/**
 * Provider OAuth Tesla per NextAuth: unico login a Telly con account Tesla.
 * Token exchange su fleet-auth con audience; profilo da GET /api/1/users/me.
 */
import type { OAuthConfig, OAuthUserConfig } from "next-auth/providers";

const TESLA_AUTHORIZE = "https://auth.tesla.com/oauth2/v3/authorize";
const TESLA_TOKEN_URL = "https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token";
const FLEET_AUDIENCE_NA = "https://fleet-api.prd.na.vn.cloud.tesla.com";
const FLEET_API_NA = "https://fleet-api.prd.na.vn.cloud.tesla.com";
const FLEET_API_EU = "https://fleet-api.prd.eu.vn.cloud.tesla.com";
const SCOPES =
  "openid offline_access user_data vehicle_device_data vehicle_location";

export interface TeslaProfile {
  id: number;
  email?: string;
  full_name?: string;
  profile_image_url?: string;
}

export default function Tesla(
  options: OAuthUserConfig<TeslaProfile>
): OAuthConfig<TeslaProfile> {
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
        const clientId = provider.clientId ?? process.env.TESLA_CLIENT_ID;
        const clientSecret = provider.clientSecret ?? process.env.TESLA_CLIENT_SECRET;
        const redirectUri = provider.callbackUrl;
        if (!clientId || !clientSecret || !redirectUri) {
          throw new Error("Tesla OAuth: missing clientId, clientSecret or callbackUrl");
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
          throw new Error(`Tesla token exchange failed: ${res.status} ${text}`);
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
          throw new Error(`Tesla userinfo failed: ${out.status} (NA e EU provati)`);
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
    options,
  };
}
