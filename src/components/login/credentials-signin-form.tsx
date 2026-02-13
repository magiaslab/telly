"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Form di login con email e password (Credentials provider).
 * Il CSRF viene richiesto dal browser così il cookie viene impostato.
 */
export function CredentialsSigninForm() {
  const searchParams = useSearchParams();
  const [csrfToken, setCsrfToken] = useState("");
  const [loading, setLoading] = useState(true);
  const error = searchParams.get("error");
  const registered = searchParams.get("registered");

  useEffect(() => {
    fetch("/api/auth/csrf", { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => setCsrfToken(data.csrfToken ?? data.token ?? ""))
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
      action="/api/auth/callback/credentials"
      method="POST"
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="callbackUrl" value="/dashboard" />
      {registered === "1" && (
        <p className="rounded-md bg-green-500/10 text-green-700 dark:text-green-400 text-sm px-3 py-2">
          Account creato. Accedi con email e password.
        </p>
      )}
      {error === "CredentialsSignin" && (
        <p className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
          Email o password non corretti.
        </p>
      )}
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="tu@email.com"
          required
          autoComplete="email"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      <Button type="submit" className="w-full" size="lg">
        Accedi
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Non hai un account?{" "}
        <Link href="/signup" className="underline hover:text-foreground">
          Registrati
        </Link>
      </p>
    </form>
  );
}
