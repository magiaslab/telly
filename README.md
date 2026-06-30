# Telly · by codecip Alessandro Cipriani

Dashboard read-only per **Tesla Model Y LR RWD** con Next.js 15 (App Router), React 19, Tesla Fleet API e Neon PostgreSQL.

**App in produzione:** [https://telly.magiaslab.com](https://telly.magiaslab.com)

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
     - Per Tesla (login + Fleet API): `TESLA_CLIENT_ID`, `TESLA_CLIENT_SECRET`, `NEXTAUTH_URL` (es. `https://telly.magiaslab.com`). Opzionale: `TESLA_REFRESH_TOKEN`, `TESLA_VIN`
     - Per la wallbox V2C: `V2C_API_KEY` (da v2c.cloud → sezione API). Opzionali: `V2C_DEVICE_ID` (se assente, rilevato automaticamente via `/pairings/me`), `V2C_WEBHOOK_SECRET` (protegge l'endpoint webhook), `V2C_PRICE_EUR_PER_KWH` (default `0.15`, usato per stimare il costo dal webhook)

3. **Database**
   ```bash
   npm run db:push
   ```
   Crea le tabelle su Neon: `telemetries`, `charging_events`, `trips`, `wallbox_sessions`, e le tabelle Auth (`user`, `account`, `session`, `verificationToken`).

4. **Avvio**
   ```bash
   npm run dev
   ```
   Apri [http://localhost:3000](http://localhost:3000) → redirect a `/dashboard`.

## Auth (login unico Tesla)

- **NextAuth v5** con **un solo provider: Tesla OAuth**. Niente email/password: si accede a Telly solo con l’account Tesla.
- **Login:** `/login` → pulsante **«Accedi con Tesla»** → OAuth Tesla → redirect a `/dashboard`. Il refresh token Tesla è salvato nel JWT di sessione.
- **Middleware:** reindirizza a `/login` su `/` e `/dashboard` se non autenticato. `/signup` reindirizza a `/login`.
- **Configurazione:** imposta `NEXTAUTH_URL` (es. `https://telly.magiaslab.com`). Su [Tesla Developer](https://developer.tesla.com) → Credenziali e API: **URI di reindirizzamento** = `NEXTAUTH_URL` + `/api/auth/callback/tesla` (es. `https://telly.magiaslab.com/api/auth/callback/tesla`).

## PWA

L’app è installabile come **Progressive Web App** (Aggiungi a Home / Install app):

- **Manifest:** `src/app/manifest.ts` → servito come `/manifest.webmanifest` (nome, icone, theme scuro, `display: standalone`).
- **Icona:** `public/icon.svg` (Telly su sfondo scuro); usata per favicon e Apple touch icon.
- **Viewport e theme:** `viewport` e `themeColor` in layout per barra di stato e fullscreen su iOS/Android.

Requisiti: sito in **HTTPS**. Su iOS: Safari → Condividi → “Aggiungi a Home”. Su Chrome/Edge: icona “Installa” nella barra degli indirizzi.

## API

- **`GET /api/sync`** – Sincronizza dati dal Tesla Fleet API verso Neon.
  - Se l’auto è **asleep** non viene fatto il fetch (per evitare vampire drain), a meno di **`?force=true`**.
  - Token: cookie `tesla_refresh_token` oppure env `TESLA_REFRESH_TOKEN`.
- **`GET /api/tesla/me`** – Profilo utente Tesla + regione (id, email, full_name, region). Senza VIN.
- **`GET /api/tesla/vehicles`** – Lista veicoli dell’account (id, vin, display_name, state). Da qui si può ricavare il VIN per il sync.
- **`POST /api/signup`** – Registrazione (email, password, nome opzionale).

### Wallbox V2C (api.v2charge.com)

Integrazione con la wallbox **V2Charge** per mostrare le ricariche reali in dashboard. Autenticazione tramite header `apikey` (variabile `V2C_API_KEY`); il `deviceId` è preso da `V2C_DEVICE_ID` o rilevato automaticamente dal primo pairing.

- **`GET /api/v2c/status`** – Stato in tempo reale (charge state, potenza kW, intensità A, tensione, energia sessione) + connettività cloud.
- **`GET /api/v2c/sessions?limit=N`** – Ricariche salvate su Neon (tabella `wallbox_sessions`).
- **`GET /api/v2c/sync?from=YYYY-MM-DD&to=YYYY-MM-DD`** – Sincronizza le ultime ricariche dalle statistiche V2C verso Neon (upsert su `deviceId`+`idCharge`).
- **`POST /api/v2c/webhook`** – Riceve gli eventi V2C `charge started` / `charge ended` e salva la sessione. Registra `https://telly.magiaslab.com/api/v2c/webhook` nel pannello V2C. Se `V2C_WEBHOOK_SECRET` è impostata, va passata come header `x-webhook-secret` o query `?secret=`.

In dashboard la card **Wallbox V2C** mostra lo stato live (auto-refresh ogni 20s), i totali del mese (energia/spesa) e la tabella delle ricariche recenti. Senza `V2C_API_KEY` (o con `NEXT_PUBLIC_USE_MOCK=true`) l'integrazione usa dati mock.

### API Tesla utilizzabili senza VIN (solo token)

Con un **access token** (refresh + client_id/secret) puoi chiamare queste Fleet API **senza passare il VIN** nel path:

| Endpoint | Descrizione | In progetto |
|----------|-------------|-------------|
| **GET /api/1/users/me** | Profilo utente (id, email, full_name) | `getTeslaUserMe()` + **GET /api/tesla/me** |
| **GET /api/1/region** | Regione account (NA / EU / CN) per base URL Fleet | `getTeslaRegion()` + `getTeslaFleetBaseUrl()` (usato in /api/tesla/me e /api/tesla/vehicles) |
| **GET /api/1/vehicles** | Lista veicoli (id, vin, display_name, state) | `listVehicles()` + **GET /api/tesla/vehicles** — da qui si ottiene il VIN per sync |
| **GET /api/1/feature_config** | Configurazione funzionalità | Non implementato |
| **GET /api/1/users/orders** | Ordini attivi utente | `getTeslaOrders()` + card Ordini in dashboard |

Per **vehicle_data**, **options**, **wake**, ecc. serve l’**id** o **VIN** ottenuto da `GET /api/1/vehicles`. Flusso consigliato: token → `getTeslaRegion()` → base URL regione → `listVehicles()` → scegliere il primo veicolo (o uno predefinito) e usare il suo VIN per sync e dashboard.

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

- **Immagine veicolo:** card Model Y con foto reale (Tesla Model Y Juniper Long Range, Stealth Grey / Lunar Grey) da [Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:Tesla_Model_Y_(2025)), in `public/vehicle/`. Attribuzione CC BY-SA 4.0 in didascalia. Il componente `TeslaVehicleImage` (compositor non documentato) resta disponibile per uso opzionale.
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
