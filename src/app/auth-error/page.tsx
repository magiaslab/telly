import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type PageProps = {
  searchParams: Promise<{ error?: string; error_description?: string }> | { error?: string; error_description?: string };
};

export default async function AuthErrorPage(props: PageProps) {
  const searchParams = await Promise.resolve(props.searchParams);
  const error = searchParams.error ?? "Configuration";
  const errorDescription = searchParams.error_description;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Errore di configurazione</CardTitle>
          <CardDescription>
            Controlla le variabili d&apos;ambiente e la configurazione Tesla Developer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(error || errorDescription) && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/50">
              <p className="font-medium text-amber-800 dark:text-amber-200">Dettaglio errore</p>
              <p><code className="rounded bg-muted px-1.5 py-0.5">{error}</code></p>
              {errorDescription && <p className="mt-1 text-muted-foreground">{errorDescription}</p>}
            </div>
          )}
          <p className="text-muted-foreground text-sm">
            Su <strong>Vercel</strong> (Environment Variables) verifica:
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm">
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5">AUTH_SECRET</code> — almeno 32 caratteri (es. <code className="rounded bg-muted px-1.5 py-0.5">openssl rand -base64 32</code>)
            </li>
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5">NEXTAUTH_URL</code> — esattamente <code className="rounded bg-muted px-1.5 py-0.5">https://telly.codecip.it</code> (nessuno slash finale)
            </li>
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5">TESLA_CLIENT_ID</code> e <code className="rounded bg-muted px-1.5 py-0.5">TESLA_CLIENT_SECRET</code> — da Tesla Developer
            </li>
          </ul>
          <p className="text-muted-foreground text-sm">
            Su <strong>Tesla Developer</strong> → Credenziali e API:
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm">
            <li>
              <strong>URI di reindirizzamento</strong> deve essere esattamente:{" "}
              <code className="break-all rounded bg-muted px-1.5 py-0.5">
                https://telly.codecip.it/api/auth/callback/tesla
              </code>
            </li>
            <li>
              <strong>Origine consentita</strong>: <code className="rounded bg-muted px-1.5 py-0.5">https://telly.codecip.it</code>
            </li>
          </ul>
          <p className="text-muted-foreground text-sm">
            Se l&apos;errore continua: in Vercel vai su <strong>Logs</strong> o <strong>Functions</strong> e cerca il messaggio reale (es. &quot;Tesla userinfo failed&quot;) al momento del login.
          </p>
          <Button asChild>
            <Link href="/login">Riprova ad accedere</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
