import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
    } & import("next-auth").DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    tesla_refresh_token?: string;
  }
}
