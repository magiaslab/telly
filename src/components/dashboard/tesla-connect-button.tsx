import { Link2 } from "lucide-react";
import { TeslaOAuthLink } from "@/components/login/tesla-oauth-link";

const CALLBACK_URL = "/dashboard?tesla_linked=1";

/** Collega account Tesla dalla dashboard (OAuth via pagina bridge). */
export function TeslaConnectButton() {
  return (
    <TeslaOAuthLink callbackUrl={CALLBACK_URL} size="sm" variant="outline" className="gap-2">
      <Link2 className="h-4 w-4" />
      Collega account Tesla
    </TeslaOAuthLink>
  );
}
