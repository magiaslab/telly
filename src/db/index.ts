import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

// Placeholder per build-time quando DATABASE_URL non è impostato (es. CI)
const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://placeholder:placeholder@placeholder.neon.tech/placeholder?sslmode=require";
const sql = neon(connectionString);
export const db = drizzle(sql);

export * from "./schema";
