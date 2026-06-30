import { Suspense } from "react";
import type { Metadata } from "next";
import { TeslaBridgeRedirect } from "@/components/login/tesla-bridge-redirect";

export const metadata: Metadata = {
  referrer: "no-referrer",
};

export default function TeslaBridgePage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Suspense
        fallback={
          <p className="text-muted-foreground text-sm">Preparazione accesso Tesla…</p>
        }
      >
        <TeslaBridgeRedirect />
      </Suspense>
    </div>
  );
}
