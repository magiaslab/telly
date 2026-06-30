import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth?.user;
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isTeslaBridge = req.nextUrl.pathname === "/auth/tesla-bridge";
  const isSignupPage = req.nextUrl.pathname === "/signup";
  const isAuthApi = req.nextUrl.pathname.startsWith("/api/auth");

  const isTeslaOAuth =
    req.nextUrl.pathname === "/api/auth/tesla/go" ||
    req.nextUrl.pathname === "/api/auth/callback/tesla" ||
    req.nextUrl.pathname === "/api/auth/tesla/callback";

  if (isAuthApi) {
    const res = NextResponse.next();
    if (isTeslaOAuth || req.nextUrl.pathname === "/api/auth/signin/tesla") {
      res.headers.set("Referrer-Policy", "no-referrer");
    }
    return res;
  }
  if (isSignupPage || isTeslaBridge) return;
  if (isLoginPage && isLoggedIn) {
    return Response.redirect(new URL("/dashboard", req.nextUrl));
  }
  if (!isLoggedIn && (req.nextUrl.pathname.startsWith("/dashboard") || req.nextUrl.pathname === "/")) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
