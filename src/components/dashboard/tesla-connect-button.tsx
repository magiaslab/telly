"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link2 } from "lucide-react";

const CALLBACK_URL = "/dashboard?tesla_linked=1";

/**
 * Pulsante per collegare l’account Tesla dalla dashboard (OAuth).
 * Richiede CSRF dal browser; dopo il redirect da Tesla l’utente torna in dashboard con tesla_linked=1.
 */
export function TeslaConnectButton() {
  const [csrfToken, setCsrfToken] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/csrf", { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => setCsrfToken(data.csrfToken ?? data.token ?? ""))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Button className="gap-2" variant="outline" size="sm" disabled>
        Caricamento…
      </Button>
    );
  }

  return (
    <form action="/api/auth/signin/tesla" method="POST" className="inline">
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="callbackUrl" value={CALLBACK_URL} />
      <Button type="submit" className="gap-2" variant="outline" size="sm">
        <Link2 className="h-4 w-4" />
        Collega account Tesla
      </Button>
    </form>
  );
}
