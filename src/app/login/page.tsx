import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CredentialsSigninForm } from "@/components/login/credentials-signin-form";
import { TeslaSigninForm } from "@/components/login/tesla-signin-form";

/**
 * Login: email/password oppure Tesla (OAuth). Flusso Tesla allineato alla guida ufficiale
 * (auth.tesla.com authorize, fleet-auth token/refresh). Se auth.tesla.com dà Access Denied
 * usa la dashboard per incollare il token o collegare da lì.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Accedi a Telly</CardTitle>
          <CardDescription>
            Email e password oppure accedi con il tuo account Tesla.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Suspense fallback={<div className="text-muted-foreground text-sm">Caricamento…</div>}>
            <CredentialsSigninForm />
          </Suspense>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-muted-foreground text-xs uppercase">
              oppure
            </div>
          </div>
          <Suspense fallback={<div className="text-muted-foreground text-sm">Caricamento…</div>}>
            <TeslaSigninForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
