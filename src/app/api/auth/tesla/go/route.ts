import { NextRequest } from "next/server";
import { prepareTeslaOAuth } from "@/lib/tesla-oauth-flow";

export const dynamic = "force-dynamic";

/**
 * Avvia OAuth Tesla senza passare da NextAuth /signin/tesla (evita Referer → Access Denied).
 * Restituisce HTML minimale che naviga verso auth.tesla.com con rel=noreferrer.
 * @see https://developer.tesla.com/docs/fleet-api/authentication/third-party-tokens
 */
export async function GET(request: NextRequest) {
  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl") ?? "/dashboard";

  let authorizeUrl: string;
  try {
    ({ authorizeUrl } = await prepareTeslaOAuth(callbackUrl));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "config";
    return Response.redirect(
      new URL(`/auth-error?error=server_config&error_description=${encodeURIComponent(msg)}`, request.url)
    );
  }

  const escaped = authorizeUrl
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="referrer" content="no-referrer" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Accesso Tesla</title>
  <style>
    body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#0a0a0a;color:#fafafa;margin:0}
    .box{text-align:center;padding:2rem}
    a{color:#fafafa}
  </style>
</head>
<body>
  <div class="box">
    <p>Reindirizzamento alla pagina di accesso Tesla…</p>
    <p><a id="tesla-go" href="${escaped}" rel="noreferrer noopener">Continua con Tesla</a></p>
  </div>
  <script>
    (function () {
      var a = document.getElementById("tesla-go");
      if (a) a.click();
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
    },
  });
}
