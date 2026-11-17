# Legal Eagle — Full-Stack Indian Legal Discovery & Consultation Booking Platform

**Legal Eagle** is a full-stack legal professional discovery and paid 1-hour consultation booking platform built with a **React + Vite + Tailwind CSS** frontend and a **Go + Gin + PostgreSQL** modular monolith backend.

---

## 1. Architecture Overview

### Frontend Stack
- **React 18 + Vite** (JavaScript JSX)
- **Tailwind CSS v4** (`#101F35` Primary Navy, `#C8A96B` Accent Gold, `#F8F7F4` Warm Cream)
- **React Router v6**, **Lucide React**, **Axios** (`src/services/apiClient.js` & `src/services/backendAdapter.js`)

### Backend Stack (Modular Monolith — No Redis, No Docker)
- **Go (`go1.26`) + Gin HTTP Framework** (`github.com/gin-gonic/gin`)
- **PostgreSQL** (`github.com/jackc/pgx/v5/pgxpool` + `sqlc` type-safe models in `internal/platform/database/sqlcgen`)
- **Swagger 2.0 Documentation** (`swaggo/swag` + `swaggo/gin-swagger`) served at `/swagger/index.html`
- **Argon2id Password Hashing** (`internal/platform/auth/argon2.go`)
- **Short-Lived JWT Access Tokens + Rotating Refresh Sessions** (`internal/platform/auth/jwt.go`)
- **In-Process Token-Bucket Rate Limiting** (`golang.org/x/time/rate`)
- **PostgreSQL Transactional Outbox & Background Worker** (`internal/workers/worker.go`)

---

## 2. Project Directory Structure

```text
cmd/
  api/main.go             # HTTP API server entrypoint (+ optional embedded worker)
  worker/main.go          # Standalone PostgreSQL-polled background worker
  migrate/main.go         # Native SQL migration & seed runner
internal/
  config/                 # Environment variable configuration
  platform/
    database/             # pgxpool connection, migrations, sqlcgen models & transactional store
    auth/                 # Argon2id password hashing & JWT/refresh-session management
    middleware/           # Auth, RBAC, CORS allowlist, in-process rate limiter, body size limit
    logger/               # Structured slog logger with automatic secret redaction
  modules/
    identity/             # Register, login, refresh rotation, logout, /auth/me
    profiles/             # Client & lawyer profiles, server-enforced contact visibility, portfolio
    firms/                # Law firm profiles & single-affiliation membership workflows
    discovery/            # Search lawyers/firms with pagination, practice area counts
    availability/         # Lawyer fee, modes, working hours, holiday blocks & 60-minute slots
    bookings/             # Module A: 10-min slot holds, booking state machine, approvals, rescheduling
    payments/             # Module B: Payment orders, Mock/Razorpay adapter, signed webhooks, full refunds
    notifications/        # Module C: In-app notifications, unread badge, mark-read
    admin/                # Audit logs & transactional outbox inspection
  workers/                # Idempotent expiration & outbox background coordinator
  shared/                 # Central state machine transitions, DTO selectors, error envelopes
db/
  migrations/             # 001_initial_schema.up.sql & .down.sql
  queries/                # sqlc SQL query definitions
  seed/                   # Initial seed dataset (12 practice areas, 22 lawyers, 6 firms, demo accounts)
docs/                     # Swagger 2.0 spec (docs.go, swagger.json, swagger.yaml)
tests/
  integration/            # 15 end-to-end booking, payment, refund, concurrency & RBAC tests
src/                      # React frontend application
sqlc.yaml
.env.example
```

---

## 3. Running Locally (Without Docker or Redis)

### Prerequisites
- **Go 1.26+**
- **PostgreSQL 15+** (local installation)
- **Node.js 18+** and **npm**

### Step 1: Configure Environment
Copy `.env.example` to `.env` and set your local PostgreSQL connection string:
```powershell
Copy-Item .env.example .env
```
Default `DATABASE_URL`:
```text
DATABASE_URL=postgresql://postgres:<YOUR_DATABASE_PASSWORD>@<SUPABASE_POOLER_HOST>:<POOLER_PORT>/postgres?sslmode=require
```

### Step 2: Run PostgreSQL Migrations & Seed Data
```powershell
go run ./cmd/migrate -dir=up -seed=true
```
*(Note: `cmd/api` also runs migrations and seeds automatically on startup when `AUTO_MIGRATE=true` and `AUTO_SEED=true`.)*

### Step 3: Start the Go Backend API Server
```powershell
go run ./cmd/api
```
- **API Base URL**: `http://localhost:8080/api/v1`
- **Interactive Swagger UI**: `http://localhost:8080/swagger/index.html`
- **Health Checks**: `http://localhost:8080/health/live` and `http://localhost:8080/health/ready`

### Step 4: Start the React Frontend
```powershell
npm install
npm run dev
```
- **Frontend URL**: `http://localhost:5173`
- Set `VITE_DEMO_MODE=false` in `.env` to use the live Go backend via `src/services/backendAdapter.js`, or leave `VITE_DEMO_MODE=true` for instant browser-seeded mode.
- In Demo Mode, lawyers and law firms can add captioned photo and video posts from their profile editor. Posts are stored in the current browser and appear on that profile's public page.

## Advocate Verification & Private Messages

- Lawyers submit their State Bar Council and enrollment number from **Advocate Messages**. A platform administrator must independently review those details and approve the request before messaging is enabled.
- Approved advocates can start private one-to-one conversations with other approved advocates. Messages are plain text, limited to 4,000 characters, and refreshed in the open conversation every four seconds. Group chat, voice/video calls, and attachments are not included.
- Admin reviewers use **Advocate verification reviews**. The seeded demo admin is `admin@demo.legaleagle.in` with the demo password shown below.
- Demo Mode stores verification requests and messages in that browser's local storage; it is for preview only and does not provide shared multi-user messaging.
- For shared messaging, configure PostgreSQL and the Go API, set `VITE_DEMO_MODE=false` in `.env`, and run both the backend and frontend. The backend migration adds the verification and conversation tables.
- Main endpoints: `GET/POST /api/v1/advocates/verification/me`, `GET /api/v1/admin/advocate-verifications`, `PATCH /api/v1/admin/advocate-verifications/{profileId}`, and `/api/v1/community/*`.

---

## 4. Seeded Demo Accounts

All seeded accounts use the Argon2id-hashed password `Password@123`:

| Role | Email | Profile ID |
| :--- | :--- | :--- |
| **Client** | `client@demo.legaleagle.in` | `c1` (Ananya Verma) |
| **Lawyer** | `lawyer@demo.legaleagle.in` | `l1` (Adv. Aarav Sharma) |
| **Lawyer 2** | `lawyer2@demo.legaleagle.in` | `l15` (Adv. Manav Gupta) |
| **Firm Admin** | `firm@demo.legaleagle.in` | `f1` (Mehra & Associates) |
| **Platform Admin** | `admin@demo.legaleagle.in` | `admin1` |

---

## 5. Running Backend Integration & Concurrency Tests

```powershell
go test -v ./tests/integration/...
```

---

## 6. Production Readiness Checklist

Before deploying to production:
1. Supply a strong 32+ byte random `JWT_ACCESS_SECRET` and set `COOKIE_SECURE=true`.
2. Configure production PostgreSQL TLS (`sslmode=verify-full`).
3. Supply live Razorpay credentials (`PAYMENT_PROVIDER=RAZORPAY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`).
4. Configure S3/GCS pre-signed upload credentials for profile photos, firm logos, and profile media posts..
