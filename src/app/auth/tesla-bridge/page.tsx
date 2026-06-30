import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

/** Reindirizza al flusso OAuth Tesla custom (compatibilità URL vecchio). */
export default async function TeslaBridgePage({ searchParams }: Props) {
  const { callbackUrl } = await searchParams;
  const target = `/api/auth/tesla/go?callbackUrl=${encodeURIComponent(callbackUrl ?? "/dashboard")}`;
  redirect(target);
}
