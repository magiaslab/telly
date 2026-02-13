/**
 * Crea un utente nel DB (tabella user).
 * Uso: npx tsx src/scripts/create-user.ts
 * Richiede: DATABASE_URL in .env, CREATE_USER_EMAIL e CREATE_USER_PASSWORD in env.
 *
 * Esempio:
 *   CREATE_USER_EMAIL=tu@email.com CREATE_USER_PASSWORD="tua-password" npx tsx src/scripts/create-user.ts
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import { users } from "../db/schema";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) {
        const val = m[2].replace(/^["']|["']$/g, "").trim();
        process.env[m[1]] = val;
      }
    }
  }
}

loadEnv();

const email = process.env.CREATE_USER_EMAIL?.trim().toLowerCase();
const password = process.env.CREATE_USER_PASSWORD;
const name = process.env.CREATE_USER_NAME?.trim() || null;

async function main() {
  if (!email || !password) {
    console.error("Imposta CREATE_USER_EMAIL e CREATE_USER_PASSWORD (e DATABASE_URL in .env)");
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url || url.includes("placeholder")) {
    console.error("DATABASE_URL mancante o placeholder in .env");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("La password deve avere almeno 8 caratteri");
    process.exit(1);
  }

  const sql = neon(url);
  const db = drizzle(sql);

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    console.log("Utente già presente:", email);
    process.exit(0);
  }

  const passwordHash = await hash(password, 12);
  await db.insert(users).values({
    email,
    password: passwordHash,
    name: name || null,
  });
  console.log("Utente creato:", email);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
