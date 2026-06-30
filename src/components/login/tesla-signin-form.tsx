import { TeslaOAuthLink } from "@/components/login/tesla-oauth-link";

/** Avvia OAuth Tesla tramite pagina bridge (senza Referer verso auth.tesla.com). */
export function TeslaSigninForm() {
  return (
    <TeslaOAuthLink callbackUrl="/dashboard" className="w-full">
      Accedi con Tesla
    </TeslaOAuthLink>
  );
}
