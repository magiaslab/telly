import { NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body as { email?: string; password?: string; name?: string };

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return Response.json(
        { error: "Email e password obbligatori" },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (password.length < 8) {
      return Response.json(
        { error: "La password deve avere almeno 8 caratteri" },
        { status: 400 }
      );
    }

    const existing = await db.select().from(users).where(eq(users.email, trimmedEmail)).limit(1);
    if (existing.length > 0) {
      return Response.json(
        { error: "Un account con questa email esiste già" },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);
    await db.insert(users).values({
      email: trimmedEmail,
      password: passwordHash,
      name: (typeof name === "string" && name.trim()) || null,
    });

    return Response.json({ ok: true, message: "Account creato. Puoi accedere." });
  } catch (e) {
    console.error("Signup error:", e);
    return Response.json(
      { error: "Errore durante la registrazione" },
      { status: 500 }
    );
  }
}
