# Pulse · Tesla Dashboard

Dashboard read-only per **Tesla Model Y LR RWD** con Next.js 15 (App Router), React 19, Tesla Fleet API e Neon PostgreSQL.

## Stack

- **Framework:** Next.js 15 (App Router) + React 19
- **DB:** Neon (PostgreSQL) con Drizzle ORM
- **UI:** Tailwind CSS, Shadcn UI (card, button, progress, badge, tabs)
- **Charts:** Recharts
- **Icons:** Lucide React
- **Validazione:** drizzle-zod per payload Tesla

## Setup

1. **Clona e installa**
   ```bash
   npm install
   ```

2. **Variabili d’ambiente**
   - Copia `.env.example` in `.env`
   - Compila:
     - `DATABASE_URL` – stringa di connessione Neon
     - `TESLA_CLIENT_ID` / `TESLA_CLIENT_SECRET` – da [Tesla Developer](https://developer.tesla.com) (piano Personal Use, ~10€/mese di credito)
     - `TESLA_REFRESH_TOKEN` – da flusso OAuth (authorization code → token → `refresh_token`)
     - `AUTH_SECRET` – segreto NextAuth (es. `openssl rand -base64 32`)
     - Per Tesla (se non usi solo mock): `TESLA_CLIENT_ID`, `TESLA_CLIENT_SECRET`, `TESLA_REFRESH_TOKEN`, `TESLA_VIN`

3. **Database**
   ```bash
   npm run db:push
   ```
   Crea le tabelle su Neon: `telemetries`, `charging_events`, `trips`, e le tabelle Auth (`user`, `account`, `session`, `verificationToken`).

4. **Avvio**
   ```bash
   npm run dev
   ```
   Apri [http://localhost:3000](http://localhost:3000) → redirect a `/dashboard`.

## Auth (Neon)

- **NextAuth v5** con Drizzle: utenti e sessioni su Neon.
- **Login** (Credentials): email + password; sessioni in DB.
- **Registrazione:** `/signup` → `POST /api/signup` (password con bcrypt).
- **Middleware:** reindirizza a `/login` su `/` e `/dashboard` se non autenticato.
- **Pagine:** `/login`, `/signup`; pulsante **Esci** in dashboard.

## API

- **`GET /api/sync`** – Sincronizza dati dal Tesla Fleet API verso Neon.
  - Se l’auto è **asleep** non viene fatto il fetch (per evitare vampire drain), a meno di **`?force=true`**.
  - Token: cookie `tesla_refresh_token` oppure env `TESLA_REFRESH_TOKEN`.
- **`POST /api/signup`** – Registrazione (email, password, nome opzionale).

## Mock Engine e seeding (senza VIN reale)

- **Toggle:** imposta `NEXT_PUBLIC_USE_MOCK=true` in `.env`. L’app userà dati mock invece della Tesla Fleet API; `/api/sync` risponde con un ritardo simulato di 500 ms (utile per testare gli skeleton).
- **Factory:** `src/lib/mock-tesla-factory.ts` genera JSON conforme a `vehicle_data` (VIN "Telly", coordinate San Vincenzo / Venturina / Livorno, clima estivo, 2,9 bar TPMS).
- **Seed Neon (30 giorni):**
  ```bash
  npm run seed
  ```
  Richiede `DATABASE_URL` reale (non placeholder). Inserisce:
  - **Telemetria** ogni 15 min (per AreaChart SoC)
  - **Ricariche** notturne 01:00–05:00 (Octopus 0,15 €/kWh)
  - **Viaggi** 2 A/R Livorno + 2 A/R Venturina a settimana (~150 Wh/km)
  Con `NEXT_PUBLIC_USE_MOCK=true` la dashboard usa il VIN mock e mostra i dati seminati.

## Dashboard

- **KPI:** Batteria (%), contachilometri, posizione (lat/lon)
- **Grafico:** SoC nel tempo (Recharts, ultimi 7 giorni)
- **Octopus:** Speso questo mese (ricariche), risparmio vs Diesel (1,75 €/L, 15 km/L — Kia 1.4 Diesel), **BarChart** risparmio per settimana (ultime 4)

## Note Next.js 15

- `cookies()` e `headers()` sono asincroni: `const cookieStore = await cookies();`
- `request.nextUrl.searchParams` per i query params nelle API Route
- Componenti con `"use client"` solo dove serve (Recharts, SyncButton)

## Script

| Comando       | Descrizione              |
|---------------|--------------------------|
| `npm run dev` | Dev server               |
| `npm run build` | Build produzione      |
| `npm run db:push` | Crea/aggiorna tabelle su Neon |
| `npm run db:generate` | Genera migration Drizzle |
| `npm run seed` | Seed Neon (30 gg telemetria, ricariche, viaggi) |
