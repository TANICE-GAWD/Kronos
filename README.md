# Kronos

> A gamified financial transfer platform that visualizes real-time transactions as physical **"packets"** travelling through a 3D simulated solar system.

Kronos pairs a performance-oriented **Go** backend with a **React + Three.js** frontend to turn an otherwise invisible action >> sending money >> into something you can *watch*. Every user is assigned a home planet on signup. When you transfer credits to another user, the backend physics engine spawns a packet that physically flies through 3D space from the sender's planet to the receiver's planet. Funds only settle when the packet **arrives** >> and a central black hole can pull packets in, voiding the transfer and refunding the sender.

**Live demo:** [kronos-lime.vercel.app](https://kronos-lime.vercel.app)
**Generated docs:** [DeepWiki >> TANICE-GAWD/Kronos](https://deepwiki.com/TANICE-GAWD/Kronos)

---

## Table of Contents

- [Preview](#preview)
- [Core Concept](#core-concept)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Transfer & Packet Lifecycle](#transfer--packet-lifecycle)
- [Physics Engine](#physics-engine)
- [Data Model](#data-model)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [WebSocket Protocol](#websocket-protocol)
- [Frontend Layer](#frontend-layer)
- [Deployment](#deployment)
- [Glossary](#glossary)

---

## Preview

<!--
  Drop screenshots/GIFs of the live 3D app here. Suggested shots:
    1. The solar system with an in-flight packet (StarCreditManager)
    2. The TransferModal mid-send
    3. The black hole pulling/destroying a packet
    4. The WalletUI / transaction history panel
  Add images to a docs/ or assets/ folder and reference them, e.g.:
  <p align="center"><img src="docs/scene.png" alt="Kronos solar system" width="800"/></p>
-->

<p align="center"><em>Screenshots of the live solar-system view go here >> see the comment above for suggested shots, or try the <a href="https://kronos-lime.vercel.app">live demo</a>.</em></p>

---

## Core Concept

A transfer in Kronos is not an instant database row update >> it is a **simulated journey**:

1. A user initiates a transfer over REST. The sender's funds are immediately **locked** (escrow) and a `pending` transaction is recorded.
2. The backend instantiates a **Packet** at the sender's home-planet position and hands it to the **Scheduler**.
3. The Scheduler runs a deterministic **60 FPS physics loop** that moves the packet toward the receiver's (orbiting, moving) planet, applying velocity, **gravitational time dilation**, and black-hole attraction.
4. On **arrival**, the transaction is **settled** >> the receiver is credited. If the packet falls into the **black hole**, the transaction is **voided** and the sender is refunded.
5. Throughout the flight, the server broadcasts the full world state over **WebSockets** so every connected client renders the packets, wallets, and transactions in real time.

---

## Features

- **Real-time 3D visualization** of money in motion using React Three Fiber.
- **Authoritative server-side physics** >> clients are pure renderers; the Go backend is the single source of truth.
- **Orbital mechanics** >> eight planets orbit the sun at scaled real-world speeds; packets *intercept* their moving destination.
- **Gravitational hazard** >> a black hole stalls (time-dilates) and ultimately destroys packets that drift too close.
- **Escrow ledger** >> funds are locked on send, settled on arrival, voided on destruction (no money created or lost).
- **JWT authentication** with bcrypt-hashed passwords; per-planet currency wallets seeded on registration.
- **WebSocket state diffing** on the client for efficient UI updates and auto-reconnect.
- **Per-planet currencies** (EARTH, MARS, VENUS, JUPITER, …) and a detailed transaction/wealth history.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend** | Go 1.25 · [Gin](https://github.com/gin-gonic/gin) | REST API, routing, middleware |
| **Real-time** | [Gorilla WebSocket](https://github.com/gorilla/websocket) | Live world-state broadcast |
| **Auth** | golang-jwt · bcrypt | JWT tokens, password hashing |
| **Database** | PostgreSQL (`lib/pq`) | Users, wallets, transactions, ledger |
| **Frontend** | React 19 · Vite 7 | SPA, routing, build tooling |
| **3D** | [Three.js](https://threejs.org) · [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) · drei | Solar-system rendering |
| **Deployment** | Railway (backend) · Vercel (frontend) | Hosting |

---

## Architecture

The system is split into a stateless-rendering **frontend** and an authoritative **backend**. REST handles authentication and actions; WebSockets handle continuous state synchronization.

```mermaid
flowchart TB
    subgraph Client["Frontend >> React + Three.js (Vercel)"]
        UI["UI Layer<br/>LoginPage · WalletUI · TransferModal · TransactionHistory"]
        Scene["3D Scene<br/>Sun · Planets · BlackHole · StarCreditManager"]
        WSM["WebSocketManager<br/>singleton · state diffing · auto-reconnect"]
    end

    subgraph Server["Backend >> Go / Gin (Railway)"]
        Router["HTTP Router + CORS"]
        Auth["Auth Service<br/>JWT + bcrypt"]
        Handlers["REST Handlers<br/>transfer · balance · history · wealth"]
        Sched["Scheduler<br/>60 FPS physics loop"]
        Phys["Physics Engine<br/>orbits · gravity · time dilation"]
        Ledger["In-memory Ledger<br/>lock / settle / void"]
        Hub["WebSocket Hub<br/>state enrichment + broadcast"]
    end

    DB[("PostgreSQL<br/>users · wallets · transactions · ledger")]

    UI -->|REST /api| Router
    Scene --> WSM
    WSM <-->|WebSocket /ws| Hub
    Router --> Auth
    Router --> Handlers
    Handlers -->|AddPacket| Sched
    Sched --> Phys
    Sched --> Ledger
    Sched -->|StateUpdate| Hub
    Handlers --> DB
    Auth --> DB
    Hub --> DB
```

---

## Transfer & Packet Lifecycle

A single transfer flows from a REST call into the physics loop and back out over WebSockets:

```mermaid
sequenceDiagram
    participant U as User (Frontend)
    participant API as Gin REST Handler
    participant DB as PostgreSQL
    participant S as Scheduler (60 FPS)
    participant P as Physics Engine
    participant H as WebSocket Hub

    U->>API: POST /api/transfer (receiver, amount, currency)
    API->>DB: Lock funds + create transaction (pending)
    API->>S: AddPacket(packet @ origin planet)
    API-->>U: 200 OK { status: "active" }

    loop every 1/60 s
        S->>P: RunPhysics(packet, blackHole, dt)
        P->>P: Move toward predicted planet position
        P->>P: Apply gravity / time dilation
        alt Reached destination
            P-->>S: status = settled
            S->>DB: SettleTransaction (credit receiver)
        else Pulled into black hole
            P-->>S: status = destroyed
            S->>DB: VoidTransaction (refund sender)
        end
        S->>H: StateUpdate { packets, wallets, transactions }
        H-->>U: Broadcast enriched state to all clients
    end
```

A packet moves through four states:

```mermaid
stateDiagram-v2
    [*] --> Active: Transfer initiated
    Active --> Stalled: Near black hole (dilation down)
    Stalled --> Active: Escapes gravity well
    Stalled --> Destroyed: Crosses event horizon
    Active --> Destroyed: Crosses event horizon
    Active --> Settled: Reaches destination planet
    Settled --> [*]: Receiver credited
    Destroyed --> [*]: Sender refunded
```

---

## Physics Engine

The engine runs server-side at a fixed **60 FPS** tick. All positions are derived from **server time**, making orbits deterministic and identical for every client.

**Tunable constants** (`backend/internal/engine/physics.go`):

| Constant | Value | Meaning |
|----------|-------|---------|
| `SpeedOfLight` | `50.0` | Base packet velocity (scale-independent) |
| `ArrivalThreshold` | `2.0` | Distance at which a packet counts as "arrived" |
| `Pull_r` | `40.0` | Black-hole event-horizon radius (packet destroyed) |
| `Time_dil` | `0.3` | Minimum time-dilation factor near the black hole |

**Behavior:**

- **Orbits** >> each planet's position is computed as `distance · (cos θ, 0, sin θ)` where `θ = serverTime · speed + initialAngle`.
- **Interception** >> packets don't aim at where the planet *is*, but iteratively predict where it *will be* (up to a 10s lead), so they curve to meet a moving target.
- **Gravity & time dilation** >> within `Pull_r + 20` of the black hole a packet is `Stalled` and its `DilationFactor` decays (slowing it); inside `Pull_r` it is `Destroyed`.
- **Curved paths** >> trajectories use quadratic Bézier interpolation for a natural arc.

**Scaled orbital data** (1 AU ≈ 100 world units):

| Planet | Distance | Speed | Currency |
|--------|---------:|------:|----------|
| Mercury | 39 | 0.82 | MERCURY |
| Venus | 72 | 0.32 | VENUS |
| Earth | 100 | 0.20 | EARTH |
| Mars | 152 | 0.11 | MARS |
| Jupiter | 520 | 0.017 | JUPITER |
| Saturn | 954 | 0.0067 | SATURN |
| Uranus | 1919 | 0.0024 | URANUS |
| Neptune | 3007 | 0.0012 | NEPTUNE |

The **Scheduler** (`scheduler.go`) guards the active-packet map with a `sync.RWMutex`, advances physics each tick, triggers settlement/voiding, and pushes a `StateUpdate` onto a buffered channel that the Hub broadcasts.

---

## Data Model

PostgreSQL holds the durable state; an in-memory ledger mirrors the escrow logic during a packet's flight.

```mermaid
erDiagram
    USERS ||--o{ WALLETS : owns
    USERS ||--o{ TRANSACTIONS : "sends / receives"
    CURRENCIES ||--o{ WALLETS : denominates
    WALLETS ||--o{ LEDGER_ENTRIES : records

    USERS {
        uuid id PK
        string username
        string password_hash
        string home_planet
    }
    WALLETS {
        uuid id PK
        uuid user_id FK
        string currency_id FK
        decimal available_balance
        decimal locked_balance
    }
    TRANSACTIONS {
        uuid id PK
        uuid sender_id FK
        uuid receiver_id FK
        decimal amount
        string status
        string origin_planet
        string destination_planet
    }
    CURRENCIES {
        string id PK
        string planet_name
        string symbol
    }
    LEDGER_ENTRIES {
        uuid id PK
        uuid wallet_id FK
    }
```

- **Wallets** track `available_balance` and `locked_balance` separately >> locking on send is what makes escrow safe.
- **Transactions** carry a `status` (`pending` → `settled` / `failed`) plus origin and destination planets.
- Stored procedures and views (`procedures.sql`, `views.sql`) back atomic settlement and the user-facing history endpoints.

---

## Repository Structure

```
Kronos/
├── backend/                          # Go API + physics engine
│   ├── cmd/api/main.go               # Entry point: wires repos, services, routes
│   └── internal/
│       ├── engine/                   # Physics + 60 FPS scheduler
│       │   ├── physics.go            # Orbits, gravity, interception, arrival
│       │   └── scheduler.go          # Tick loop, settle/void, state broadcast
│       ├── finance/ledger.go         # In-memory escrow ledger (lock/settle/void)
│       ├── transport/                # HTTP + WebSocket layer
│       │   ├── handlers.go           # Transfer, balance, history, wealth
│       │   ├── auth_handlers.go      # Register, login, user search
│       │   ├── middleware.go         # JWT auth middleware
│       │   ├── hub.go                # WebSocket hub + state enrichment
│       │   └── client.go             # Per-connection WebSocket client
│       ├── auth/auth_service.go      # JWT issuing/verification, bcrypt
│       ├── models/                   # User, Wallet, Transaction, Packet
│       ├── repository/               # PostgreSQL data access + seeding
│       └── db/                       # schema_enhanced.sql, procedures.sql, views.sql
│
└── kronos/                           # React + Three.js frontend
    └── src/
        ├── App.jsx                   # Main scene, routing, HUD
        ├── components/               # 3D objects + UI
        │   ├── Sun.jsx, Planet.jsx, BlackHole.jsx, OrbitLine.jsx
        │   ├── StarCreditManager.jsx # Renders in-flight packets
        │   ├── WalletUI.jsx, TransferModal.jsx, TransactionHistory.jsx
        │   └── PlanetFollowCamera.jsx, FollowPlanetTab.jsx, Notification.jsx
        ├── pages/                    # LoginPage.jsx, RegisterPage.jsx
        ├── hooks/useWebSocket.js     # React hook over WebSocketManager
        ├── services/WebSocketManager.js  # Singleton WS client + diffing
        └── utils/                    # timeSync.js, planetCurrency.js
```

---

## Getting Started

### Prerequisites

- **Go** 1.25+
- **Node.js** 18+ and npm
- **PostgreSQL** 14+

### 1. Database

Create a database and apply the schema, procedures, and views:

```bash
createdb kronos
psql kronos -f backend/internal/db/schema_enhanced.sql
psql kronos -f backend/internal/db/procedures.sql
psql kronos -f backend/internal/db/views.sql
```

### 2. Backend

Create `backend/.env`:

```env
DATABASE_URL=postgres://user:password@localhost:5432/kronos?sslmode=disable
JWT_SECRET=replace-with-a-long-random-secret
```

Run it:

```bash
cd backend
go mod download
go run ./cmd/api
```

The API starts on **`http://localhost:8080`**. Currencies are seeded automatically on boot.

### 3. Frontend

```bash
cd kronos
npm install
npm run dev
```

The app starts on Vite's dev server (**`http://localhost:5173`**) and connects to the backend at `http://localhost:8080` / `ws://localhost:8080/ws`.

> **Note:** the frontend currently points at `localhost:8080` directly in source. For a non-local deployment, update the API/WS URLs in `src/pages/*`, `src/components/*`, and `src/services/WebSocketManager.js`.

---

## API Reference

Base URL: `http://localhost:8080/api`. Protected routes require an `Authorization: Bearer <token>` header.

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/register` | Create a user (`username`, `password` ≥ 8, `home_planet`). Seeds a 1000-credit wallet. |
| `POST` | `/login` | Authenticate; returns a 24h JWT. |
| `GET` | `/users/search?q=` | Search users by username (for transfers). |

### Protected (JWT required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/transfer` | Initiate a transfer (`receiver_username`, `amount`, `currency_id`). Locks funds, launches a packet. |
| `GET` | `/balance/:userID` | Available balances + escrow snapshot. |
| `GET` | `/history/:userID` | In-memory ledger history. |
| `GET` | `/user/me/wealth` | Wealth summary across all currencies. |
| `GET` | `/user/me/wallets-detailed` | Wallets with currency metadata. |
| `GET` | `/user/me/transactions` | Persisted transaction history (view-backed). |
| `GET` | `/transactions/:txID/status-history` | Status-change audit trail for a transaction. |

### WebSocket

| Endpoint | Description |
|----------|-------------|
| `GET /ws` | Upgrade to WebSocket; receive continuous world-state broadcasts. |

**Example >> register & login:**

```bash
curl -X POST http://localhost:8080/api/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"astro","password":"supersecret","home_planet":"earth"}'

curl -X POST http://localhost:8080/api/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"astro","password":"supersecret"}'
```

---

## WebSocket Protocol

On every physics tick that has active packets, the Hub **enriches** the raw scheduler snapshot with the latest users, wallets, and transactions from the database, then broadcasts a single JSON `StateUpdate`:

```jsonc
{
  "timestamp": 1716800000000,
  "packets": {
    "<uuid>": {
      "id": "<uuid>",
      "origin_planet": "earth",
      "destination_planet": "mars",
      "current_pos": { "x": 12.3, "y": 0.4, "z": -88.1 },
      "status": "active",          // active | stalled | destroyed | settled
      "dilationfactor": 1.0,
      "velocity": 50.0
    }
  },
  "wallets":      { "<userID>": { "currency_id": "EARTH", "available_balance": 950 } },
  "transactions": [ { "id": "...", "status": "pending", "amount": 50 } ],
  "users":        { "<userID>": { "username": "astro", "home_planet": "earth" } }
}
```

On the client, the **`WebSocketManager`** singleton maintains the connection (with exponential-backoff reconnect), diffs incoming state against the previous snapshot, and notifies subscribed React components only when something relevant changes.

---

## Frontend Layer

- **`App.jsx`** sets up the React Three Fiber `<Canvas>`, the orbit-controlled camera (far plane at 100k units), the HUD, and routing between the auth pages and the main scene.
- **Scene components** (`Sun`, `Planet`, `BlackHole`, `OrbitLine`) render the solar system; `PlanetFollowCamera` + `FollowPlanetTab` let you lock the camera onto a planet.
- **`StarCreditManager`** consumes the live packet stream and renders each in-flight transfer as a moving object.
- **`WalletUI`**, **`TransferModal`**, and **`TransactionHistory`** make up the financial UI >> checking balances, searching recipients, sending credits, and reviewing history.
- **`useWebSocket`** wraps `WebSocketManager` for idiomatic React consumption.

---

## Deployment

| Component | Platform | Notes |
|-----------|----------|-------|
| Backend | **Railway** | Set `DATABASE_URL` and `JWT_SECRET`; exposes port `8080`. |
| Frontend | **Vercel** | Static Vite build (`npm run build`). |
| Database | Managed PostgreSQL | Apply `schema_enhanced.sql`, `procedures.sql`, `views.sql`. |

CORS on the backend already allows the deployed Vercel origin and common localhost dev ports.

---

## Glossary

| Term | Meaning |
|------|---------|
| **Packet** | Ephemeral 3D object representing money in transit between two planets. |
| **Home planet** | The planet assigned to a user at signup; defines their default currency. |
| **Ledger** | In-memory escrow tracking available / locked / settled funds during flight. |
| **Settlement** | Crediting the receiver when a packet reaches its destination. |
| **Voiding** | Refunding the sender when a packet is destroyed by the black hole. |
| **Time dilation** | Slowing of a packet (`DilationFactor`) as it nears the black hole. |
| **Scheduler** | Server loop that advances physics at 60 FPS and broadcasts state. |
| **Hub** | WebSocket broadcaster that enriches and fans out world state to all clients. |

---

