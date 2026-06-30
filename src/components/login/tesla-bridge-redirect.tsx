"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Pagina intermedia per OAuth Tesla senza inviare Referer ad auth.tesla.com.
 * Il WAF Akamai blocca authorize se il Referer proviene da /login o /api/auth/signin/tesla.
 * Si arriva qui tramite link con rel="noreferrer", poi POST interno verso NextAuth.
 */
export function TeslaBridgeRedirect() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/csrf", { credentials: "same-origin" });
        const data = await res.json();
        const csrfToken = data.csrfToken ?? data.token ?? "";
        if (!csrfToken) {
          if (!cancelled) setError("Impossibile ottenere il token CSRF. Ricarica la pagina.");
          return;
        }
        const form = document.createElement("form");
        form.method = "POST";
        form.action = "/api/auth/signin/tesla";
        form.style.display = "none";

        const csrfInput = document.createElement("input");
        csrfInput.type = "hidden";
        csrfInput.name = "csrfToken";
        csrfInput.value = csrfToken;
        form.appendChild(csrfInput);

        const cbInput = document.createElement("input");
        cbInput.type = "hidden";
        cbInput.name = "callbackUrl";
        cbInput.value = callbackUrl;
        form.appendChild(cbInput);

        document.body.appendChild(form);
        form.submit();
      } catch {
        if (!cancelled) setError("Errore di rete durante il collegamento a Tesla.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [callbackUrl]);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Collegamento Tesla</CardTitle>
        <CardDescription>
          {error ?? "Reindirizzamento alla pagina di accesso Tesla…"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!error && (
          <p className="text-muted-foreground text-sm">
            Se non vieni reindirizzato entro pochi secondi, torna al login e riprova.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
