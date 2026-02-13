import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
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
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toString?.()?.trim?.()?.toLowerCase?.();
        const password = credentials?.password?.toString?.();
        if (!email || !password) return null;
        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!user?.password || !(await compare(password, user.password))) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          image: user.image ?? undefined,
        };
      },
    }),
    Tesla({
      clientId: process.env.TESLA_CLIENT_ID!,
      clientSecret: process.env.TESLA_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    jwt({ token, user, account }) {
      if (account?.provider === "tesla" && account.refresh_token) {
        token.tesla_refresh_token = account.refresh_token;
        if (token.sub) {
          return token;
        }
      }
      if (user) {
        token.sub = user.id;
        token.email = user.email ?? undefined;
        token.name = user.name ?? undefined;
        token.picture = user.image ?? undefined;
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
