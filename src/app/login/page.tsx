import { cookies, headers } from "next/headers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Login con form POST nativo a NextAuth (evita fetch → redirect che causa CORS su auth.tesla.com).
 * Il CSRF viene letto lato server; il submit è una navigazione completa.
 */
export default async function LoginPage() {
  const cookieStore = await cookies();
  const headersList = await headers();
  const origin = headersList.get("x-forwarded-host")
    ? `${headersList.get("x-forwarded-proto") ?? "https"}://${headersList.get("x-forwarded-host")}`
    : process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  let csrfToken = "";
  try {
    const res = await fetch(`${origin}/api/auth/csrf`, {
      headers: { Cookie: cookieStore.toString() },
      cache: "no-store",
    });
    const data = await res.json();
    csrfToken = data.token ?? "";
  } catch {
    // fallback: form senza CSRF (NextAuth potrebbe rifiutare; in dev può funzionare)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Accedi a Telly</CardTitle>
          <CardDescription>
            Usa il tuo account Tesla per entrare nella dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
