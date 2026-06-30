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
          {error === "userinfo_failed" && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-800 dark:bg-blue-950/50">
              <p className="font-medium text-blue-900 dark:text-blue-100">Profilo Tesla non letto</p>
              <p className="mt-1 text-muted-foreground">
                Il login Tesla è andato a buon fine ma non è stato possibile leggere il profilo.
                Spesso succede se l&apos;app ha permessi vecchi senza scope <code className="rounded bg-muted px-1">user_data</code>.
              </p>
              <p className="mt-2 text-muted-foreground">
                Revoca l&apos;accesso dell&apos;app Tesla dal tuo account, poi riprova il login:
              </p>
              <p className="mt-1">
                <a
                  href="https://auth.tesla.com/user/revoke/consent"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  Gestisci app di terze parti Tesla
                </a>
              </p>
            </div>
          )}
          <ul className="list-inside list-disc space-y-1 text-sm">
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5">AUTH_SECRET</code> — almeno 32 caratteri (es. <code className="rounded bg-muted px-1.5 py-0.5">openssl rand -base64 32</code>)
            </li>
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5">NEXTAUTH_URL</code> — esattamente <code className="rounded bg-muted px-1.5 py-0.5">https://telly.magiaslab.com</code> (nessuno slash finale)
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
              <strong>URI di reindirizzamento</strong> (deve coincidere con{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">TESLA_REDIRECT_URI</code> su Vercel), es.{" "}
              <code className="break-all rounded bg-muted px-1.5 py-0.5">
                https://telly.magiaslab.com/api/auth/tesla/callback
              </code>{" "}
              oppure{" "}
              <code className="break-all rounded bg-muted px-1.5 py-0.5">
                https://telly.magiaslab.com/api/auth/callback/tesla
              </code>
            </li>
            <li>
              Partner account registrato su regione <strong>EU</strong> per account italiani
            </li>
            <li>
              <strong>Origine consentita</strong>: <code className="rounded bg-muted px-1.5 py-0.5">https://telly.magiaslab.com</code>
            </li>
          </ul>
          <p className="text-muted-foreground text-sm">
            Se vedi <strong>Access Denied</strong> su auth.tesla.com, il login ora passa da{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">/api/auth/tesla/go</code> senza Referer.
            Usa il pulsante &quot;Continua con Tesla&quot; dalla pagina di login (non bookmark vecchi).
          </p>
          <Button asChild>
            <Link href="/login">Riprova ad accedere</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
