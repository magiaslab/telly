import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TeslaSigninForm } from "@/components/login/tesla-signin-form";

/**
 * Login con form POST nativo a NextAuth (evita CORS su auth.tesla.com).
 * Il CSRF viene richiesto dal browser (client) così il cookie viene impostato correttamente.
 */
export default function LoginPage() {
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
          <TeslaSigninForm />
        </CardContent>
      </Card>
    </div>
  );
}
