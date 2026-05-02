# DhanLekha ERP

> AI-Powered Offline-First ERP Billing System for Indian Small & Medium Businesses

DhanLekha (धनलेखा — "wealth ledger") is a multi-tenant, offline-first ERP system designed for retailers, vendors, and shopkeepers. It provides billing, inventory management, accounting, analytics, and AI-driven automation while ensuring high performance and reliability without continuous internet.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js + React + TypeScript |
| Desktop | Electron |
| Backend | Node.js + Express.js + TypeScript |
| AI Service | Python + FastAPI |
| Local DB | SQLite (offline-first) |
| Cloud DB | PostgreSQL |
| Cache | Redis |
| Queue | BullMQ |
| HTTP Client | Axios |
| Monorepo | Turborepo |
| Container | Docker + Docker Compose |
| Auth | JWT + bcrypt |
| Validation | Zod |

---

## Project Structure

```
dhanlekha/
├── apps/
│   ├── backend/                    # Node.js + Express API server (TS)
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── app.ts              # Express app (middleware + routes)
│   │       ├── server.ts           # HTTP server entry point
│   │       ├── config/
│   │       │   ├── env.ts          # Environment variables
│   │       │   ├── database.ts     # Knex DB connection
│   │       │   ├── knexfile.ts     # Knex config (SQLite + PostgreSQL)
│   │       │   └── redis.ts        # Redis client (graceful failure)
│   │       ├── middleware/
│   │       │   ├── auth.middleware.ts           # JWT authentication
│   │       │   ├── authorize.middleware.ts      # Role-based access (admin/cashier)
│   │       │   ├── errorHandler.middleware.ts   # Global error handler
│   │       │   ├── requestLogger.middleware.ts  # Request logging
│   │       │   └── validate.middleware.ts       # Zod validation factory
│   │       ├── modules/
│   │       │   ├── auth/                        # Register, login endpoints
│   │       │   ├── users/                       # User CRUD (admin only)
│   │       │   ├── branches/                    # Branch/Store management
│   │       │   ├── products/                    # Product & Inventory APIs
│   │       │   ├── customers/                   # Customer management & credit
│   │       │   ├── suppliers/                   # Supplier management
│   │       │   ├── tenants/                     # Tenant profiles
│   │       │   └── health/                      # GET /api/v1/health
│   │       ├── repositories/
│   │       │   ├── base.repo.ts                 # Base multi-tenant repo
│   │       │   ├── branch.repo.ts               # Branch management
│   │       │   ├── inventory.repo.ts            # Branch-scoped inventory
│   │       │   ├── product.repo.ts              # Product catalog
│   │       │   ├── customer.repo.ts             # Customer profile & financial ledger
│   │       │   ├── supplier.repo.ts             # Supplier data
│       │   ├── invoice.repo.ts              # Invoices, items, and sequences
│   │       │   ├── tenant.repo.ts
│   │       │   └── user.repo.ts
│   │       ├── database/
│   │       │   ├── transaction.ts               # withTransaction helper
│   │       │   ├── migrations/                  # Knex migrations (Sprint 1+)
│   │       │   └── seeds/                       # Knex seed data (Sprint 1+)
│   │       └── utils/
│   │           ├── errors.ts                    # Error classes (400/401/403/404/409/422)
│   │           └── response.ts                  # Standard response helpers
│   ├── frontend/                   # Next.js + Electron (Sprint 17+)
│   │   └── package.json
│   └── ai-service/                 # Python FastAPI (Sprint 14+)
│       └── README.md
├── packages/
│   └── shared/                     # Shared utilities & types
│       ├── api.ts                  # Axios client factory with interceptors
│       ├── index.ts                # Main export
│       ├── types.ts                # Shared TS interfaces (User, Tenant, etc)
│       ├── tsconfig.json
│       └── package.json
├── docs/
│   ├── srs.md                      # Software Requirements Specification
│   ├── db.md                       # Database schema (25 tables)
│   ├── techstack.md                # Technology stack decisions
│   ├── sprint.md                   # Sprint execution plan (21 sprints)
│   └── progress.md                 # Sprint progress tracker
├── .agents/skills/                 # AI agent skill definitions
│   ├── api-design/
│   ├── backend-development/
│   ├── billing-logic/
│   ├── code-review/
│   ├── database-enforcement/
│   └── erp-context/
├── docker-compose.yml              # PostgreSQL + Redis + Backend
├── turbo.json                      # Turborepo configuration
├── package.json                    # Root monorepo config
├── master-context.md               # Master document index
├── .env                            # Environment variables
└── .gitignore
```

---

## Quick Start

### Prerequisites

- Node.js >= 18
- Docker & Docker Compose (for PostgreSQL + Redis)
- npm

### 1. Install Dependencies

```bash
npm install
```

### 2. Run with Docker (Recommended)

Start PostgreSQL, Redis, and the backend:

```bash
docker compose up -d
```

### 3. Run Backend Locally (without Docker)

```bash
npm run dev:backend
```

Or directly:

```bash
cd apps/backend && node src/server.js
```

The server starts at **http://localhost:3001**

### 4. Verify

```bash
curl http://localhost:3001/api/v1/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-05-01T10:15:19.221Z",
    "uptime": 15.69,
    "services": {
      "database": { "status": "connected" },
      "redis": { "status": "connected" }
    }
  }
}
```

---

## Architecture

```
Frontend (Next.js + Electron)
        │ Axios
        ▼
Backend (Node.js + Express)
        │
   ┌────┴────┐
   ▼         ▼
SQLite    PostgreSQL
(local)    (cloud)
        │
   ┌────┴────┐
   ▼         ▼
Redis     BullMQ
(cache)   (queue)
        │
        ▼
AI Service (Python FastAPI) — optional
```

---

## Development Roadmap

| Phase | Sprints | Focus | Status |
|-------|---------|-------|--------|
| Phase 1 | 0–2 | Backend infrastructure, auth, SaaS | ✅ Complete |
| Phase 2 | 3–10 | Core ERP backend APIs | 🔄 In Progress |
| Phase 3 | 11–14 | System features (sync, alerts, AI) | ⬜ Not Started |
| Phase 4 | 15–16 | Performance & production readiness | ⬜ Not Started |
| Phase 5 | 17–20 | Frontend (after backend is complete) | ⬜ Not Started |

> **Backend-first development** — all 16 backend sprints must complete before any frontend work begins.

See [docs/sprint.md](docs/sprint.md) for the full execution plan and [docs/progress.md](docs/progress.md) for current status.

---

## Key Features (Planned)

- 🧾 **Billing & Invoicing** — GST-compliant, barcode scanning, discount engine
- 📦 **Inventory Management** — Stock tracking, batch support (FEFO), audit logs
- 💰 **Payment System** — Multi-invoice allocation, advance payments, UPI/cash/card
- 📒 **Ledger (Udhaar)** — Append-only double-entry, running balance, daily snapshots
- 🏪 **Multi-Tenant SaaS** — Plan-based feature gating, usage quotas
- 📴 **Offline-First** — SQLite local DB, sync queue, conflict resolution
- 🤖 **AI Features** — Product parsing, demand prediction, smart suggestions
- 📊 **Analytics** — Daily metrics, sales reports, profit calculation

---

## 🔌 API Reference

The backend follows RESTful principles and returns standard JSON responses. All protected routes require a Bearer JWT token.

### 🏥 System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Service health status & connectivity |

### 🔐 Authentication & Identity
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new tenant + admin user |
| POST | `/api/v1/auth/login` | Authenticate & get JWT token |
| GET | `/api/v1/users` | List staff members (Admin only) |
| POST | `/api/v1/users` | Add new cashier or admin |
| DELETE | `/api/v1/users/:id` | Soft-delete a user account |

### 🏢 Store & Branch Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/tenants/me` | Get active tenant business profile |
| GET | `/api/v1/branches` | List all physical store locations |
| POST | `/api/v1/branches` | Create a new store branch |
| PATCH | `/api/v1/branches/:id` | Update branch contact info/address |

### 📦 Product & Inventory
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/products` | Search catalog & check branch stock |
| POST | `/api/v1/products` | Add product with initial inventory |
| GET | `/api/v1/products/low-stock` | List items below threshold alerts |
| POST | `/api/v1/products/:id/adjust` | Manual stock correction with audit log |

### 🤝 Business Partners (CRM/SRM)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/customers` | Search/list customers & udhaar balances |
| POST | `/api/v1/customers` | Add customer with credit limit |
| GET | `/api/v1/suppliers` | Search/list inventory suppliers |
| POST | `/api/v1/suppliers` | Add supplier with GST details |

### 🧾 Billing & Invoicing (Sprint 5)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/invoices` | Create atomic invoice (stock + ledger sync) |
| GET | `/api/v1/invoices` | List billing history (paginated) |
| GET | `/api/v1/invoices/:id` | Get full invoice detail with items |
| DELETE | `/api/v1/invoices/:id` | Cancel invoice & reverse stock/ledger |
| GET | `/api/v1/products/barcode/:code` | Fast barcode lookup |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `BACKEND_PORT` | `3001` | Backend server port |
| `POSTGRES_DB` | `dhanlekha` | PostgreSQL database name |
| `POSTGRES_USER` | `dhanlekha` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `dhanlekha_secret` | PostgreSQL password |
| `REDIS_PORT` | `6379` | Redis port |
| `JWT_SECRET` | (dev default) | JWT signing secret |
| `JWT_EXPIRES_IN` | `7d` | JWT token expiry |

---

## License

Private — All rights reserved.
