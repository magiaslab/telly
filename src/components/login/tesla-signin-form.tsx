"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Form POST a NextAuth signin/tesla. Il CSRF va richiesto dal browser (fetch)
 * così il cookie Set-Cookie viene applicato; altrimenti NextAuth risponde MissingCSRF.
 */
export function TeslaSigninForm() {
  const [csrfToken, setCsrfToken] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/csrf", { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => {
        setCsrfToken(data.csrfToken ?? data.token ?? "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Button className="w-full" size="lg" disabled>
        Caricamento…
      </Button>
    );
  }

  return (
    <form
      action="/api/auth/signin/tesla"
      method="POST"
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="callbackUrl" value="/dashboard" />
      <Button type="submit" className="w-full" size="lg">
        Accedi con Tesla
      </Button>
    </form>
  );
}
