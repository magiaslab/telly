import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CredentialsSigninForm } from "@/components/login/credentials-signin-form";

/**
 * Login con email e password. Il collegamento Tesla si fa dall’app (env o da dashboard).
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Accedi a Telly</CardTitle>
          <CardDescription>
            Inserisci email e password. Puoi collegare Tesla dalla dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="text-muted-foreground text-sm">Caricamento…</div>}>
            <CredentialsSigninForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
