import NextAuth from "next-auth";
import Tesla from "@/lib/tesla-auth-provider";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 giorni
  },
  pages: {
    signIn: "/login",
    error: "/auth-error",
  },
  providers: [
    Tesla({
      clientId: process.env.TESLA_CLIENT_ID!,
      clientSecret: process.env.TESLA_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    jwt({ token, user, account }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email ?? undefined;
        token.name = user.name ?? undefined;
        token.picture = user.image ?? undefined;
      }
      if (account?.provider === "tesla" && account.refresh_token) {
        token.tesla_refresh_token = account.refresh_token;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        if (token.sub) session.user.id = token.sub;
        if (token.email != null) session.user.email = token.email;
        if (token.name != null) session.user.name = token.name;
        if (token.picture != null) session.user.image = token.picture;
      }
      return session;
    },
  },
});
