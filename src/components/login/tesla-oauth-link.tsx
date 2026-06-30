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

/** Link OAuth Tesla via pagina bridge (evita Referer verso auth.tesla.com). */
export function TeslaOAuthLink({
  callbackUrl = "/dashboard",
  className,
  size = "lg",
  variant = "default",
  children,
}: TeslaOAuthLinkProps) {
  const href = `/auth/tesla-bridge?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  return (
    <Button asChild className={className} size={size} variant={variant}>
      <Link href={href} rel="noreferrer noopener">
        {children}
      </Link>
    </Button>
  );
}
