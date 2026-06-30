import { NextRequest } from "next/server";
import { handleTeslaOAuthCallback } from "@/lib/tesla-oauth-callback";

export const dynamic = "force-dynamic";

/** Callback OAuth Tesla (URI registrato su Tesla Developer). */
export async function GET(request: NextRequest) {
  return handleTeslaOAuthCallback(request);
}
