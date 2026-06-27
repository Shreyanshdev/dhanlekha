# 📊 Sprint Progress Tracker

## AI-Powered Offline ERP Billing System

---

## Current Sprint: Sprint 17 — Accounting Foundations & Tech-Debt Cleanup
**Status:** ⬜ Not Started
**Phase:** 4.5 — Premium ERP Backend (Sprints 17–29)

> Backend Sprints 0–16 are complete. Phase 4.5 (Sprints 17–29) adds the premium ERP layer
> (accounting, GST, orders, CRM, platform) and Phase 4.6 (Sprints 30–32) adds offline resilience,
> drafts/chit, bulk onboarding, and licensing — before frontend work. Frontend is now Phase 5, Sprints 33–41.

---

## Sprint Log

### Sprint 0: Project Setup & Environment
**Status:** ✅ Complete
**Goal:** Establish a stable, dockerized development environment with backend as primary focus.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Initialize monorepo structure | ✅ Done | Turborepo + npm workspaces: `/apps/backend`, `/apps/frontend`, `/apps/ai-service`, `/packages/shared` |
| 2 | Setup Node.js + Express backend with modular folder structure | ✅ Done | Layered: modules/{feature}/, middleware/, config/, utils/ |
| 3 | Configure Knex.js with SQLite (local) + PostgreSQL (cloud) | ✅ Done | `knexfile.js` with dev (SQLite) + prod (PostgreSQL) configs |
| 4 | Setup environment config (.env, dotenv) | ✅ Done | Centralized `config/env.js` with .env file |
| 5 | Configure Docker + Docker Compose | ✅ Done | PostgreSQL 16, Redis 7, Backend containers. `docker-compose.yml` |
| 6 | Setup request logging middleware | ✅ Done | `requestLogger.middleware.js` — logs method, URL, status, response time |
| 7 | Setup global error handler middleware | ✅ Done | `errorHandler.middleware.js` + structured error classes (AppError, ValidationError, etc.) |
| 8 | Install & configure Axios in shared package | ✅ Done | `packages/shared/api.js` — factory with JWT interceptor, 401 handler |
| 9 | Setup health check endpoint: `GET /api/v1/health` | ✅ Done | Returns DB + Redis status, uptime. Tested and verified |
| 10 | Verify server starts and responds correctly | ✅ Done | Server starts on :3001, health returns JSON, 404 handler works |

**Files Created:**
- `package.json` — Root monorepo config
- `turbo.json` — Turborepo task config
- `docker-compose.yml` — PostgreSQL, Redis, Backend
- `.env` — Environment variables
- `.gitignore` — Standard ignores
- `apps/backend/package.json` — Backend dependencies
- `apps/backend/Dockerfile` — Backend container
- `apps/backend/src/server.js` — Server entry point
- `apps/backend/src/app.js` — Express app setup
- `apps/backend/src/config/env.js` — Environment config
- `apps/backend/src/config/database.js` — Knex DB connection
- `apps/backend/src/config/knexfile.js` — Knex config (SQLite + PostgreSQL)
- `apps/backend/src/config/redis.js` — Redis client (graceful failure)
- `apps/backend/src/middleware/errorHandler.middleware.js` — Global error handler
- `apps/backend/src/middleware/requestLogger.middleware.js` — Request logger
- `apps/backend/src/middleware/validate.middleware.js` — Zod validation factory
- `apps/backend/src/modules/health/health.routes.js` — Health check endpoint
- `apps/backend/src/utils/errors.js` — Error classes (400/401/403/404/409/422)
- `apps/backend/src/utils/response.js` — Standard response helpers
- `packages/shared/api.js` — Axios client factory
- `packages/shared/index.js` — Shared package entry
- `apps/frontend/package.json` — Placeholder (Sprint 17)
- `apps/ai-service/README.md` — Placeholder (Sprint 14)

---

### Sprint 1: Multi-Tenant & Subscription System
**Status:** ✅ Complete
**Goal:** Build the SaaS backbone — tenant management and feature gating APIs.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Create `plans`, `feature_flags`, `plan_features` tables | ✅ Done | Migration: `20260501104800_init_saas_schema.ts` |
| 2 | Create `tenants`, `users` tables with multi-tenant design | ✅ Done | UUID PKs, soft-delete, tenant_id FK |
| 3 | Create `tenant_overrides`, `usage_tracking`, `subscriptions` | ✅ Done | Feature gating infrastructure |
| 4 | Seed default plans (Starter/Growth/Enterprise) | ✅ Done | Seed: `001_seed_saas_plans.ts` |
| 5 | Seed feature flags and plan_features | ✅ Done | max_invoices, max_users, enable_api, enable_ai |
| 6 | `POST /api/v1/auth/register` — create tenant + admin | ✅ Done | Atomic transaction, bcrypt hashing |
| 7 | `GET /api/v1/tenants/me` — current tenant profile | ✅ Done | JWT auth required |
| 8 | `PATCH /api/v1/tenants/me` — update tenant profile | ✅ Done | Zod validation |

---

### Sprint 2: User Management & Authentication
**Status:** ✅ Complete
**Goal:** Secure multi-user environment with JWT auth and role-based access.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Create `settings`, `invoice_sequences` tables | ✅ Done | Migration: `20260502053500_sprint2_settings_sequences.ts` |
| 2 | `POST /api/v1/auth/login` — authenticate, return JWT | ✅ Done | Cross-tenant email lookup, bcrypt verify, JWT sign |
| 3 | Role middleware: `authorize('admin')` | ✅ Done | `authorize.middleware.ts` — factory pattern |
| 4 | `GET /api/v1/users` — list staff (admin only) | ✅ Done | Tenant-scoped, never exposes password_hash |
| 5 | `POST /api/v1/users` — create staff user (admin only) | ✅ Done | Duplicate email check per tenant |
| 6 | `PATCH /api/v1/users/:id` — update user (admin only) | ✅ Done | Last-admin protection, email uniqueness |
| 7 | `DELETE /api/v1/users/:id` — soft-delete (admin only) | ✅ Done | Cannot delete last admin |
| 8 | Zod validation schemas for all endpoints | ✅ Done | createUserSchema, updateUserSchema, userIdParamSchema |
| 9 | Shared types expanded (UserPublic, Setting, etc.) | ✅ Done | `packages/shared/types.ts` |
| 10 | Postman collection updated with all endpoints | ✅ Done | Login auto-saves JWT to collection variable |

### Sprint 3: Product & Inventory Management
**Status:** ✅ Complete
**Goal:** Core inventory management with barcode support and automatic logging.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Create `products`, `inventory`, `inventory_batches`, `inventory_logs` | ✅ Done | Migration: `20260502063500_sprint3_products_inventory.ts` |
| 2 | `POST /api/v1/products` — create product + initial stock | ✅ Done | Atomic transaction across 3 tables |
| 3 | `GET /api/v1/products` — list/search with inventory summary | ✅ Done | Join logic in `ProductRepository` |
| 4 | `GET /api/v1/products/barcode/:code` — super-fast lookup | ✅ Done | Indexed barcode search |
| 5 | `POST /api/v1/products/:id/adjust` — manual stock correction | ✅ Done | Audit trail logged automatically |
| 6 | `GET /api/v1/products/low-stock` — alerts based on threshold | ✅ Done | Filtered by `min_stock_alert` |

### Sprint 3.5: Multi-Branch (Multi-Store) Foundation
**Status:** ✅ Complete
**Goal:** Transition from single-store to multi-store architecture with strict branch isolation.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Implement `BranchScopedRepository<T>` | ✅ Done | Automatic `branch_id` injection and filtering |
| 2 | Create `branches` table and management module | ✅ Done | Full CRUD for store/branch management |
| 3 | Scoped Inventory isolation | ✅ Done | Inventory queries automatically filtered by `branch_id` |
| 4 | Refactor Auth for Branch Awareness | ✅ Done | Default branch creation on register; `branchId` in JWT |
| 5 | Security & Edge Case Verification | ✅ Done | Verified cross-tenant/cross-branch isolation |

### Sprint 4: Customer & Supplier Management
**Status:** ✅ Complete
**Goal:** Build people management APIs with credit tracking.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Create `customers`, `suppliers` tables | ✅ Done | Migration: `20260502090000_sprint4_customers_suppliers.ts` |
| 2 | `POST /api/v1/customers` — create customer | ✅ Done | With credit limit support |
| 3 | `GET /api/v1/customers` — list/search | ✅ Done | Search by name or phone |
| 4 | `POST /api/v1/suppliers` — create supplier | ✅ Done | With GST number tracking |
| 5 | `GET /api/v1/suppliers` — list/search | ✅ Done | Search by name or phone |
| 6 | Soft-delete support for both | ✅ Done | Preserves history for billing |

### Sprint 5: Billing Engine (Core)
**Status:** ✅ Complete
**Goal:** Build the most critical part of the system — atomic, GST-compliant billing.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Create `invoices`, `invoice_items`, `customer_ledger` | ✅ Done | Migration: `20260502100000_sprint5_billing_engine.ts` |
| 2 | Consolidated Domain Repositories | ✅ Done | Merged Invoice and Customer repositories |
| 3 | Thread-safe sequential numbering | ✅ Done | Using `SELECT FOR UPDATE` on sequences |
| 4 | Atomic `POST /api/v1/invoices` workflow | ✅ Done | 10-step atomic flow with stock/ledger sync |
| 5 | Credit Limit Enforcement | ✅ Done | Blocks sales if customer's outstanding balance > limit |
| 6 | Soft-delete cancellation logic | ✅ Done | Full reversal of stock and ledger entries |
| 7 | Full Code Review & Stress Test | ✅ Done | Passed 45/45 critical assertions in `billing_stress_test.js` |

### Sprint 6: Barcode-Based Billing (Backend Enhancement)
**Status:** ✅ Complete
**Goal:** Optimize backend for high-speed scanning and manual price overrides.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | `GET /api/v1/products/barcode/:code` | ✅ Done | Sub-50ms lookup returning Product + Inventory |
| 2 | Manual Price Override Logic | ✅ Done | `unit_price` and `gst_rate` optional in validator, fallback to DB |
| 3 | Bulk Scan Optimization | ✅ Done | O(1) query batch-fetching for products and inventory in `createInvoice` |

### Sprint 7: Payment System
**Status:** ✅ Complete
**Goal:** Build flexible payment recording with multi-invoice allocation.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Migration: `payments` + `payment_allocations` tables | ✅ Done | Proper FKs, indices, unique constraint on `(payment_id, invoice_id)` |
| 2 | `POST /api/v1/payments` — Record + allocate payment | ✅ Done | Atomic 8-step workflow inside `withTransaction` |
| 3 | `POST /api/v1/payments/:id/allocate` — Advance payment allocation | ✅ Done | Allocates unallocated credit to new invoices |
| 4 | `GET /api/v1/payments` — List with pagination & filters | ✅ Done | Filterable by customer, status, payment mode |
| 5 | `GET /api/v1/payments/:id` — Detail with allocations | ✅ Done | Batch-fetches allocations for list as well |
| 6 | Customer ledger + `total_due` sync on payment | ✅ Done | Correct credit entry + balance decrement |
| 7 | Payment Stress Test | ✅ Done | Passed 38/38 assertions in `sprint7_test.js` |

### Sprint 8: Ledger System
**Status:** ✅ Complete
**Goal:** Advanced ledger management, snapshots, and balance integrity.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Ledger schema (snapshots + audit columns) | ✅ Done | Added `balance_snapshot` and audit triggers |
| 2 | Paginated ledger API (`GET /customers/:id/ledger`) | ✅ Done | Efficient cursor-based pagination |
| 3 | Balance summary + Integrity check API (`GET /customers/:id/balance`) | ✅ Done | Verifies sum of entries vs stored balance |
| 4 | Atomic manual adjustments (Admin only) | ✅ Done | `POST /api/v1/ledger/adjust` with audit reasons |
| 5 | Ledger snapshot logic for historical queries | ✅ Done | Automated periodic snapshotting |
| 6 | Full API verification | ✅ Done | Passed 10/10 test cases in `ledger_test.js` |

### Sprint 9: Purchase & Expense Management
**Status:** ✅ Complete
**Goal:** Implementation of stock-in (purchases) and operating costs (expenses) with inventory synchronization.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Purchase Schema (`purchases`, `purchase_items`) | ✅ Done | Normalized schema with tax and payment tracking |
| 2 | Expense Schema (`expenses`) | ✅ Done | Categorized cost tracking with soft delete |
| 3 | Atomic Purchase Workflow | ✅ Done | Syncs stock levels + updates latest cost price |
| 4 | Inventory Logs Integration | ✅ Done | Immutable audit trail for every purchase |
| 5 | Paginated Listing & Filtering | ✅ Done | Category/Date/Supplier filters for reports |
| 6 | Reliability & Deep Testing | ✅ Done | Passed 18/18 test cases across basic and deep suites |

### Sprint 10: Discount & Offer Engine
**Status:** ✅ Complete
**Goal:** Build flexible promotion system with 4 offer types integrated with billing engine.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Offers Schema + `offer_id` FK on `invoice_items` | ✅ Done | Full indexing + usage tracking columns |
| 2 | CRUD APIs (Create, Read, Update, Soft-delete) | ✅ Done | Admin-only write access |
| 3 | Offer Matching Engine (`findBestOfferForItem`) | ✅ Done | Flat/Percentage/BOGO/Bundle logic |
| 4 | Zod Validation (% cap, BOGO rules, date ranges) | ✅ Done | 4 business rule refinements |
| 5 | Paginated Listing + Filters | ✅ Done | Type/Scope/Active/Date range filters |
| 6 | Authorization & Soft-delete verification | ✅ Done | Passed 15/15 test cases |

### Sprint 11: Offline Sync Engine
**Status:** ✅ Complete
**Goal:** Build robust offline-first capabilities with conflict resolution.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Push sync with conflict resolution | ✅ Done | Deterministic logic |
| 2 | Pull sync (version-based cursor) | ✅ Done | Efficient delta updates |
| 3 | Device registry & version tracking | ✅ Done | Client-side tracking |
| 4 | Status & Retry mechanisms | ✅ Done | Resilient sync |

### Sprint 12: Alerts & Notifications
**Status:** ✅ Complete
**Goal:** Build proactive alerting system for stock, payments, and sync issues.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Alerts database schema | ✅ Done | `alerts` table |
| 2 | Alert generator job | ✅ Done | Low stock, payment due, sync fail |
| 3 | Read/List API endpoints | ✅ Done | With `is_read` filters |

### Sprint 13: Analytics & Reporting
**Status:** ✅ Complete
**Goal:** Build business intelligence APIs.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | `daily_metrics` schema | ✅ Done | Pre-aggregated stats |
| 2 | Metrics aggregator job | ✅ Done | Aggregate daily |
| 3 | Analytics APIs | ✅ Done | Daily, Dashboard, Profit |

### Sprint 14: AI Integration
**Status:** ✅ Complete
**Goal:** Connect Python AI service to ERP backend.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | `product_ai_data` schema | ✅ Done | AI metadata cache |
| 2 | Python FastAPI service | ✅ Done | Product parser, voice, suggestions, demand |
| 3 | AI client + circuit breaker | ✅ Done | Graceful degradation |
| 4 | Granular plan gating | ✅ Done | 4 separate AI feature flags |
| 5 | 5 backend AI endpoints | ✅ Done | parse, voice, suggest, demand, enrich |

### Sprint 15: Performance Optimisation
**Status:** ✅ Complete
**Goal:** Ensure backend meets all SRS performance targets.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | 30+ missing indexes | ✅ Done | All db.md Section 13 indexes applied |
| 2 | Redis caching layer | ✅ Done | getOrSet pattern, key builders, pattern invalidation |
| 3 | Barcode lookup cache | ✅ Done | Sub-1ms with Redis, sub-2ms without |
| 4 | Dashboard cache | ✅ Done | 5min TTL on pre-aggregated data |
| 5 | BullMQ job scheduler | ✅ Done | metrics (daily), alerts (15min), usage reset (monthly) |
| 6 | Performance benchmarks | ✅ Done | All SRS targets passed |

### Sprint 16: Production Readiness
**Status:** ✅ Complete
**Goal:** Harden backend for production deployment.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Structured logging (Pino) | ✅ Done | JSON in prod, pretty-print in dev, sensitive field redaction |
| 2 | Request/Error logger upgrade | ✅ Done | Structured fields: method, url, status, duration, IP |
| 3 | Health + Readiness probes | ✅ Done | /health (liveness + memory), /health/ready (readiness) |
| 4 | Rate limiting (3-tier) | ✅ Done | Global 200/min, Auth 10/min, Heavy 30/min |
| 5 | Input sanitisation | ✅ Done | XSS, prototype pollution, NoSQL injection |
| 6 | Helmet.js hardening | ✅ Done | CSP, HSTS, X-Content-Type, X-Powered-By removed |
| 7 | Docker production config | ✅ Done | Multi-stage build, non-root user, HEALTHCHECK |
| 8 | E2E test suite | ✅ Done | 3 workflows + security validation |

## Phase 4.5 — Premium ERP Backend (Sprints 17–29)

> Elevates the backend from billing/POS to a premium ERP + CRM platform. Backend-first, before frontend.

### Sprint 17: Accounting Foundations & Tech-Debt Cleanup
**Status:** ⬜ Not Started
**Goal:** Money-unit standardisation, audit logging, settings/subscriptions APIs, wire offers into billing, enforce plan quotas, fix usage_tracking + scheduler, schedule ledger snapshot job.

### Sprint 18: Double-Entry General Ledger
**Status:** ⬜ Not Started
**Goal:** chart_of_accounts, journal_entries, journal_lines; default CoA seed; postJournal service; hook invoice/payment/purchase/expense postings.

### Sprint 19: Accounts Payable & Supplier Payments
**Status:** ⬜ Not Started
**Goal:** supplier_ledger, supplier_payments + allocations; purchases post AP entries; outstanding payable per supplier.

### Sprint 20: Financial Statements & Reporting
**Status:** ⬜ Not Started
**Goal:** Trial Balance, P&L, Balance Sheet, Cash Flow, Day Book; financial_years + opening_balances; year-end close.

### Sprint 21: GST Compliance & e-Invoicing
**Status:** ⬜ Not Started
**Goal:** CGST/SGST/IGST split + place_of_supply; HSN summary; GSTR-1/3B; e-invoice (IRN/QR) + e-way bill via GSP adapter.

### Sprint 22: Credit / Debit Notes & Returns
**Status:** ⬜ Not Started
**Goal:** credit_notes/debit_notes + items; sales/purchase return workflows with stock + GST + GL reversal.

### Sprint 23: Bank & Cash Management
**Status:** ⬜ Not Started
**Goal:** bank_accounts, cash_registers, bank_transactions; account-linked payments/expenses; reconciliation; cash book.

### Sprint 24: Sales & Purchase Order Management
**Status:** ⬜ Not Started
**Goal:** quotations, sales_orders, purchase_orders, goods_receipts, delivery_challans with conversion flows.

### Sprint 25: Advanced Inventory & Valuation
**Status:** ⬜ Not Started
**Goal:** stock_transfers, price_lists, units/uom_conversions, product_serials; FEFO wiring; FIFO/WAC valuation; reorder/auto-PO.

### Sprint 26: CRM Core — Leads & Pipeline
**Status:** ⬜ Not Started
**Goal:** leads, opportunities, pipeline_stages, activities; lead→opportunity→customer conversion.

### Sprint 27: Customer Engagement & Communication
**Status:** ⬜ Not Started
**Goal:** segments, campaigns, message_templates, communication_logs, loyalty; email/SMS/WhatsApp providers.

### Sprint 28: RBAC & Auth Hardening
**Status:** ⬜ Not Started
**Goal:** roles/permissions/role_permissions; refresh tokens, logout, password reset, 2FA; permission-matrix middleware.

### Sprint 29: Platform, Integrations & Observability
**Status:** ⬜ Not Started
**Goal:** API keys, webhooks, OpenAPI docs, subscription billing gateway, file storage, PDF/Excel export, sync apply worker, tests + observability.

---

## Phase 4.6 — Offline Resilience, Drafts & Onboarding (Sprints 30–32)

> Hardens real retail-floor and offline operation. Backend-first; matching client work lands in Phase 5.

### Sprint 30: Draft "Chit" Invoices & Soft Reserve
**Status:** ⬜ Not Started
**Goal:** Draft invoices without GST sequence; daily token_number; soft-reserve stock (`reserved` logs); atomic finalize to formal invoice + ledger.

### Sprint 31: Bulk Onboarding Import & Additive Inventory Sync
**Status:** ⬜ Not Started
**Goal:** CSV import for products/customers (transactional, full rollback on bad row); additive (delta-based) inventory conflict resolution in the sync worker.

### Sprint 32: Offline Security & Licensing
**Status:** ⬜ Not Started
**Goal:** Signed-JWT offline license + monotonic clock guard; offline PIN hashing; LICENSE_EXPIRED / QUOTA_EXCEEDED / SECURITY_LOCKDOWN enforcement before offline writes.

---

## Phase 5 — Frontend (Sprints 33–41)

### Sprint 33: Foundation & Auth Shell
**Status:** ⬜ Not Started
**Goal:** Next.js + auth shell + Electron; SQLite IPC bridge, offline PIN login, ESC/POS raw printing bridge.

### Sprint 34: Dashboard & Analytics
**Status:** ⬜ Not Started

### Sprint 35: Product Management & Inventory
**Status:** ⬜ Not Started

### Sprint 36: Billing Engine UI (Critical)
**Status:** ⬜ Not Started
**Goal:** Billing screen; AI suggestion fallback (circuit breaker → local SQLite), draft/chit mode, raw print + cash drawer.

### Sprint 37: Customers, Ledger & Payments
**Status:** ⬜ Not Started

### Sprint 38: Suppliers, Purchases & Expenses
**Status:** ⬜ Not Started

### Sprint 39: Offers, Alerts, Staff & Settings
**Status:** ⬜ Not Started

### Sprint 40: Sync, Offline & Invoice History
**Status:** ⬜ Not Started

### Sprint 41: Product Landing Page
**Status:** ⬜ Not Started

---

## Summary

| Phase | Sprints | Status |
|-------|---------|--------|
| Phase 1: Foundation | 0–2 | ✅ Complete |
| Phase 2: Core ERP | 3–10 | ✅ Complete |
| Phase 3: System Features | 11–14 | ✅ Complete |
| Phase 4: Performance & Production | 15–16 | ✅ Complete |
| Phase 4.5: Premium ERP Backend | 17–29 | ⬜ Not Started |
| Phase 4.6: Offline Resilience & Drafts | 30–32 | ⬜ Not Started |
| Phase 5: Frontend | 33–41 | ⬜ Not Started |
