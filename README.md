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
│   │       │   ├── auth/           # Login & Registration
│   │       │   ├── users/          # Staff management
│   │       │   ├── branches/       # Multi-location management
│   │       │   ├── products/       # Catalog & Inventory
│   │       │   ├── customers/      # CRM & Credit management
│   │       │   ├── suppliers/      # SRM & Procurement
│   │       │   ├── invoices/       # (Sprint 5-6) Atomic Billing Engine
│   │       │   ├── payments/       # (Sprint 7) Payment Recording & Allocation
│   │       │   ├── ledger/         # (Sprint 8) Financial Ledgers & Integrity
│   │       │   ├── purchases/      # (Sprint 9) Stock-in & Supplier tracking
│   │       │   ├── expenses/       # (Sprint 9) Operating cost management
│   │       │   ├── offers/         # (Sprint 10) Discount & Promotion engine
│   │       │   ├── sync/           # (Sprint 11) Offline Sync Engine
│   │       │   ├── alerts/         # (Sprint 12) System Alerts & Notifications
│   │       │   ├── analytics/      # (Sprint 13) Business Intelligence & Reporting
│   │       │   ├── ai/             # (Sprint 14) AI Integration (parse, voice, suggest, demand, enrich)
│   │       │   ├── tenants/        # SaaS Tenant management
│   │       │   └── health/         # System status
│   │       ├── repositories/
│   │       │   ├── base.repo.ts          # Generic multi-tenant base
│   │       │   ├── branch.repo.ts        # Branch-scoped queries
│   │       │   ├── customer.repo.ts      # Customer profiles & balances
│   │       │   ├── expense.repo.ts       # Operating costs
│   │       │   ├── inventory.repo.ts     # Branch inventory logs
│   │       │   ├── invoice.repo.ts       # Invoices & line items
│   │       │   ├── payment.repo.ts       # Payments & allocations
│   │       │   ├── product.repo.ts       # Product catalog & barcodes
│   │       │   ├── offer.repo.ts         # Promotions & discounts
│   │       │   ├── sync.repo.ts          # Offline sync queue & devices
│   │       │   ├── alert.repo.ts         # System alerts
│   │       │   ├── analytics.repo.ts     # Pre-aggregated metrics
│   │       │   ├── productAiData.repo.ts # AI-enriched product metadata
│   │       │   ├── purchase.repo.ts      # Stock-in recordings
│   │       │   ├── supplier.repo.ts      # Supplier data
│   │       │   ├── tenant.repo.ts        # Global tenant profiles
│   │       │   └── user.repo.ts          # Staff accounts
│   │       ├── database/
│   │       │   ├── transaction.ts        # Atomic transaction helper
│   │       │   ├── migrations/           # Knex migrations (Sprints 1-10)
│   │       │   └── seeds/                # Seed data (plans, default admins)
│   │       └── utils/
│   │           ├── errors.ts             # Custom HTTP error classes
│   │           └── response.ts           # Standard API response helpers
│   ├── frontend/                   # Next.js + Electron (Sprint 17+)
│   │   └── package.json
│   └── ai-service/                 # Python FastAPI (Sprint 14)
│       ├── package.json            # Monorepo workspace config (npm run dev:ai)
│       ├── main.py                 # FastAPI app entry
│       ├── requirements.txt        # Python dependencies
│       ├── README.md               # Full API documentation
│       ├── routers/                # API endpoints
│       │   ├── product.py          # Product parsing + enrichment
│       │   ├── voice.py            # Voice billing parser (Hindi/English)
│       │   ├── suggestions.py      # Smart product suggestions (trigram)
│       │   ├── demand.py           # Demand prediction (WMA + trend)
│       │   └── health.py           # Health check
│       └── models/
│           └── schemas.py          # Pydantic request/response models
├── packages/
│   └── shared/                     # Monorepo shared package
│       ├── api.ts                  # Shared Axios client logic
│       ├── index.ts                # Main export entry
│       ├── types.ts                # Universal TS interfaces (Invoice, Payment, etc)
│       ├── tsconfig.json
│       └── package.json
├── api-testing/                    # Post-sprint API test suites
│   ├── sprint7_test.js             # Payments verification
│   ├── sprint8_test.js             # Ledger integrity verification
│   ├── sprint9_test.js             # Purchases & Expenses basic
│   ├── sprint9_deep_test.js        # Auth & Reliability deep-dive
│   ├── sprint10_test.js            # Offers CRUD & validation
│   └── test_all_apis.js            # Full integration smoke test
├── docs/
│   ├── srs.md                      # Requirement specs
│   ├── db.md                       # Data modeling
│   ├── progress.md                 # Sprint tracking
│   └── sprint.md                   # Execution plan
├── .agents/skills/                 # AI agent skill definitions (api, backend, etc)
├── docker-compose.yml              # Dev infra (PG, Redis)
├── turbo.json                      # Build system config
├── package.json                    # Workspace root
├── master-context.md               # Master document index
├── .env                            # Environment secrets
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
| Phase 2 | 3–10 | Core ERP backend APIs | ✅ Complete |
| Phase 3 | 11–14 | System features (sync, alerts, AI) | 🔄 In Progress |
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

### 📈 Ledger System (Sprint 8)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/customers/:id/ledger` | Chronological ledger entries (paginated) |
| GET | `/api/v1/customers/:id/balance` | Current balance + integrity check summary |
| POST | `/api/v1/ledger/adjust` | Manual debit/credit adjustment (Admin only) |

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

### 🧾 Billing & Invoicing (Sprint 5 & 6)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/invoices` | Create atomic invoice (stock + ledger sync) |
| GET | `/api/v1/invoices` | List billing history (paginated) |
| GET | `/api/v1/invoices/:id` | Get full invoice detail with items |
| DELETE | `/api/v1/invoices/:id` | Cancel invoice & reverse stock/ledger |
| GET | `/api/v1/products/barcode/:code` | Fast barcode lookup — returns product + inventory |

### 💰 Payments (Sprint 7)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/payments` | Record payment; optionally allocate to invoices |
| GET | `/api/v1/payments` | List payments (paginated, filterable) |
| GET | `/api/v1/payments/:id` | Get payment detail with allocations |
| POST | `/api/v1/payments/:id/allocate` | Allocate advance payment to specific invoices |

### 🛒 Purchases & Expenses (Sprint 9)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/purchases` | Record stock-in (increments inventory + logs) |
| GET | `/api/v1/purchases` | List purchase history (paginated) |
| GET | `/api/v1/purchases/:id` | Get purchase detail with items |
| POST | `/api/v1/expenses` | Record operating cost (Admin only) |
| GET | `/api/v1/expenses` | List expenses (filterable by category/date) |
| DELETE | `/api/v1/expenses/:id` | Soft-delete an expense entry |

### 🏷️ Offers & Discounts (Sprint 10)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/offers` | Create offer (flat/percentage/BOGO/bundle) |
| GET | `/api/v1/offers` | List offers (filterable by type/scope/active/date) |
| GET | `/api/v1/offers/:id` | Get offer detail |
| PATCH | `/api/v1/offers/:id` | Update offer fields (Admin only) |
| DELETE | `/api/v1/offers/:id` | Soft-delete offer (Admin only) |

### 🔄 Sync Engine (Sprint 11)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/sync/push` | Push offline changes to cloud |
| GET | `/api/v1/sync/pull` | Pull new changes from cloud |
| GET | `/api/v1/sync/status` | Get sync queue health |
| GET | `/api/v1/sync/queue` | List sync queue (Admin only) |
| GET | `/api/v1/sync/devices` | List registered devices |

### 🔔 Alerts & Notifications (Sprint 12)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/alerts` | List system alerts (filter by read status) |
| PATCH | `/api/v1/alerts/:id/read` | Mark alert as read |

### 📊 Analytics & Reporting (Sprint 13)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/analytics/dashboard` | Aggregated high-level metrics |
| GET | `/api/v1/analytics/daily` | Time-series daily snapshots |
| GET | `/api/v1/analytics/profit` | P&L calculation for date range |

### 🤖 AI Integration (Sprint 14)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/ai/parse-product` | AI product name parsing (Growth+) |
| POST | `/api/v1/ai/parse-voice` | Voice billing transcript parser (Enterprise) |
| POST | `/api/v1/ai/suggest-products` | Smart product suggestions (Growth+) |
| GET | `/api/v1/ai/demand/:productId` | Demand prediction (Enterprise) |
| POST | `/api/v1/ai/enrich-product` | Background AI product enrichment (Growth+) |
| GET | `/api/v1/ai/suggestions/:productId` | Get cached AI data for product |


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
