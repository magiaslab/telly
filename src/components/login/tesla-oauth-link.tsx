import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type TeslaOAuthLinkProps = {
  callbackUrl?: string;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  children: ReactNode;
};

/** Avvia OAuth Tesla custom (/api/auth/tesla/go) senza Referer verso auth.tesla.com. */
export function TeslaOAuthLink({
  callbackUrl = "/dashboard",
  className,
  size = "lg",
  variant = "default",
  children,
}: TeslaOAuthLinkProps) {
  const href = `/api/auth/tesla/go?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  return (
    <Button asChild className={className} size={size} variant={variant}>
      <Link href={href} rel="noreferrer noopener" prefetch={false}>
        {children}
      </Link>
    </Button>
  );
}
