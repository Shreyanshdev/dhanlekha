# Software Development Roadmap
## AI-Powered Offline ERP Billing System

---

# 1. Introduction

This document defines the execution roadmap for building a production-grade ERP system. The system is designed to support multi-tenant businesses with offline-first capabilities, integrated billing, inventory, accounting, and AI-driven enhancements.

**Development priority: BACKEND FIRST.** All backend APIs, services, database schemas, and business logic must be fully built, tested, and stable before frontend work begins. The frontend will consume the backend via **Axios** for all HTTP requests.

---

# 2. Development Strategy

- **Backend-first development** — every sprint builds backend APIs before any UI
- Incremental delivery through sprints
- Modular monolithic architecture initially
- Strong emphasis on data integrity and financial correctness
- Offline-first design with synchronization capabilities
- **Axios** is the standard HTTP client for all frontend-to-backend and service-to-service communication

---

# 3. HTTP Client Standard

## Axios

All HTTP requests across the system use **Axios** as the standard HTTP client.

### Where Axios is used:
- **Frontend (Next.js) → Backend (Node.js)** — all API calls
- **Backend → AI Service (Python FastAPI)** — inter-service communication
- **Sync Engine** — push/pull operations to cloud endpoints

### Axios Setup Rules:
- Create a centralised Axios instance with base URL and default headers
- Attach JWT token via Axios request interceptor
- Handle 401 (token expired) via Axios response interceptor with auto-refresh
- Set reasonable timeouts (10s default, 30s for sync operations)
- Use Axios interceptors for global error handling and logging

### Example Setup:
```javascript
// /packages/shared/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.API_BASE_URL || 'http://localhost:3001/api/v1',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
});

// Request interceptor — attach JWT
api.interceptors.request.use((config) => {
  const token = getToken(); // from local storage or auth store
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — handle errors globally
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // Handle token refresh or logout
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default api;
```

### Usage Pattern:
```javascript
// In frontend service/hook
import api from '@shared/api';

// GET with query params
const products = await api.get('/products', { params: { page: 1, limit: 20, search: 'milk' } });

// POST
const invoice = await api.post('/invoices', { customer_id, items, amount_paid });

// PATCH
await api.patch(`/products/${id}`, { name: 'Updated Name' });

// DELETE (soft delete)
await api.delete(`/customers/${id}`);
```

---

# 4. Sprint Execution Plan

---

## Phase 1: Foundation (Backend Infrastructure)

---

### Sprint 0: Project Setup & Environment

**Objective:** Establish a stable development environment with the backend as the primary focus.

**Scope:**
- Initialize monorepo (Turborepo/Nx) with `/apps/backend`, `/apps/frontend`, `/apps/ai-service`
- Setup Node.js + Express backend with modular folder structure:
  ```
  /src/modules/{feature}/controller.js, service.js, repository.js, validator.js, routes.js
  /src/middleware/
  /src/config/
  /src/jobs/
  /src/utils/
  ```
- Configure SQLite (local) and PostgreSQL (cloud) with Knex.js query builder
- Setup environment config (.env, dotenv)
- Configure Docker + Docker Compose for all services
- Setup request logging middleware
- Setup global error handler middleware
- Install and configure **Axios** in shared package for frontend and inter-service use
- Setup basic health check endpoint: `GET /api/v1/health`

**Outcome:** Running backend server with database connectivity, standard middleware, and Axios configured.

---

### Sprint 1: Multi-Tenant & Subscription System (Backend)

**Objective:** Build the SaaS backbone — tenant management and feature gating APIs.

**Scope — Backend APIs:**
- `POST /api/v1/auth/register` — create tenant + admin user
- `GET /api/v1/tenants/me` — get current tenant profile
- `PATCH /api/v1/tenants/me` — update tenant profile

**Database Tables:**
- `plans` — subscription tiers (Starter, Growth, Enterprise)
- `feature_flags` — feature registry
- `plan_features` — feature limits per plan (quota/toggle)
- `subscriptions` — payment history
- `tenant_overrides` — custom limits per tenant
- `usage_tracking` — real-time quota consumption

**Key Logic:**
- Feature enforcement order: tenant_overrides → plan_features → usage_tracking
- Feature gate middleware: `featureGate('max_invoices_per_month')`
- Seed default plans and feature flags in migration

**Outcome:** Working SaaS layer with plan-based restrictions enforced via middleware.

---

### Sprint 2: User Management & Authentication (Backend)

**Objective:** Secure multi-user environment with JWT auth and role-based access.

**Scope — Backend APIs:**
- `POST /api/v1/auth/login` — authenticate, return JWT
- `GET /api/v1/users` — list staff (admin only)
- `POST /api/v1/users` — create staff user (admin only)
- `PATCH /api/v1/users/:id` — update user
- `DELETE /api/v1/users/:id` — soft-delete user

**Database Tables:**
- `tenants` (if not from Sprint 1)
- `users` — staff accounts with role (admin/cashier)
- `settings` — per-tenant key-value config
- `invoice_sequences` — thread-safe invoice number generator

**Key Logic:**
- JWT-based authentication with bcrypt password hashing
- Auth middleware: verify JWT → set req.userId, req.tenantId
- Role middleware: `authorize('admin')` for restricted routes
- Tenant middleware: inject tenant_id from JWT, never from request body
- Cashier can only: create invoices, accept payments, view own sales

**Outcome:** Secure auth system with role-based access control.

---

## Phase 2: Core ERP (Backend APIs)

---

### Sprint 3: Product & Inventory Management (Backend)

**Objective:** Build product catalogue and stock tracking APIs.

**Scope — Backend APIs:**
- `GET /api/v1/products` — list products (paginated, searchable) + stock for requesting user's branch
- `GET /api/v1/products/barcode/:code` — barcode scanner lookup (< 50ms)
- `POST /api/v1/products` — create product (tenant-wide) + inventory row (for active branch)
- `PUT /api/v1/products/:id` — update product
- `DELETE /api/v1/products/:id` — soft-delete product
- `GET /api/v1/inventory` — list stock levels (branch-scoped)
- `PATCH /api/v1/inventory/:productId` — manual stock adjustment (branch-scoped)
- `POST /api/v1/inventory/enable` — enable existing product for another branch

**Database Tables:**
- `products` — catalogue (name, barcode, GST rate, unit)
- `inventory` — summary stock per product per branch (branch_id + product_id UNIQUE)
- `inventory_batches` — optional batch tracking (FEFO) per branch
- `inventory_logs` — immutable audit trail of all stock movements per branch

**Key Logic:**
- Product + inventory created together (product is catalogue, inventory is stock)
- Barcode lookup must use `idx_products_barcode` index and filter by `branch_id`
- Manual adjustments create `inventory_logs` entry (change_type = 'adjustment')
- Stock movement logging: every insert to inventory_logs is append-only, never update

**Outcome:** Complete product + inventory API with branch-scoped audit trail.

---

### Sprint 3.5: Branch Management (Backend)

**Objective:** Implement the Multi-Branch architecture to allow a single tenant to manage multiple physical stores.

**Scope — Backend APIs:**
- `POST /api/v1/branches` — create branch (admin only, validates against `max_branches` quota)
- `GET /api/v1/branches` — list all branches for the tenant
- `PATCH /api/v1/branches/:id` — update branch details
- `DELETE /api/v1/branches/:id` — soft-delete branch

**Database Tables:**
- `branches` — physical store locations

**Key Logic:**
- Introduce `BranchScopedRepository` extending `BaseRepository`.
- Refactor all branch-specific entities (`users`, `inventory`, `invoices`, `purchases`, etc.) to use `BranchScopedRepository`.
- Ensure JWT token includes `branchId`. Admins can specify `X-Branch-Id` header to operate across branches.

**Outcome:** System fully supports multi-store operations under a single subscription.

---

### Sprint 4: Customer & Supplier Management (Backend)

**Objective:** Build people management APIs with credit tracking.

**Scope — Backend APIs:**
- `GET /api/v1/customers` — list customers (paginated)
- `POST /api/v1/customers` — create customer
- `PUT /api/v1/customers/:id` — update customer
- `DELETE /api/v1/customers/:id` — soft-delete
- `GET /api/v1/customers/:id/balance` — current balance (from ledger)
- `GET /api/v1/suppliers` — list suppliers
- `POST /api/v1/suppliers` — create supplier
- `PUT /api/v1/suppliers/:id` — update supplier
- `DELETE /api/v1/suppliers/:id` — soft-delete

**Database Tables:**
- `customers` — with credit_limit, total_due (cached)
- `suppliers` — with GST number

**Key Logic:**
- `total_due` is denormalised cache — source of truth is `customer_ledger`
- Credit limit enforcement checked during invoice creation
- Phone-based customer lookup uses `idx_customers_phone` index

**Outcome:** Customer + supplier management with credit tracking foundation.

---

### Sprint 5: Billing Engine (Backend)

**Objective:** Build the core billing system — the most critical sprint.

**Scope — Backend APIs:**
- `POST /api/v1/invoices` — create invoice (full atomic workflow)
- `GET /api/v1/invoices` — list invoices (paginated, filterable by status/date)
- `GET /api/v1/invoices/:id` — get invoice with line items
- `DELETE /api/v1/invoices/:id` — cancel invoice (soft-delete + reverse inventory/ledger)

**Database Tables:**
- `invoices` — sale transactions with computed totals
- `invoice_items` — line items with snapshotted unit_price and gst_rate

**Atomic Invoice Creation (single transaction):**
1. Check quota (usage_tracking for max_invoices_per_month)
2. Lock invoice_sequences (SELECT FOR UPDATE) → generate invoice number
3. Calculate line items: (unit_price × qty) - discount + GST
4. INSERT invoice + invoice_items
5. Decrement inventory.total_quantity (FEFO for batch tracking)
6. INSERT inventory_logs (change_type = 'sale', quantity_change = -N)
7. INSERT customer_ledger (entry_type = 'invoice', debit = final_amount)
8. UPDATE customers.total_due += final_amount
9. INCREMENT usage_tracking.used_count
10. INCREMENT offers.used_count (if offer applied)

**Key Logic:**
- GST calculated AFTER discount (Indian GST law)
- All prices on invoice_items are snapshots — immutable after creation
- Never trust frontend calculations — recalculate everything server-side
- `final_amount = subtotal - discount_amount + tax_amount`
- Credit limit check before creating credit invoice

**Outcome:** Fully functional, financially correct billing API.

---

### Sprint 6: Barcode-Based Billing (Backend)

**Objective:** Optimise the barcode scanning path for near-instant billing.

**Scope — Backend APIs:**
- `GET /api/v1/products/barcode/:code` — optimised for < 50ms response
- Barcode → product → inventory → price in a single optimised query

**Key Logic:**
- Use `idx_products_barcode` index
- Return product + current inventory (selling_price, total_quantity) in one response
- Frontend sends scanned barcode via Axios GET, receives product data instantly
- USB barcode scanners act as keyboard input — frontend captures and sends to API

**Outcome:** Sub-50ms barcode-to-product lookup.

---

### Sprint 7: Payment System (Backend)

**Objective:** Build flexible payment recording with multi-invoice allocation.

**Scope — Backend APIs:**
- `POST /api/v1/payments` — record payment + allocate to invoices
- `GET /api/v1/payments` — list payments (paginated)
- `GET /api/v1/payments/:id` — payment detail with allocations

**Database Tables:**
- `payments` — money received (amount, mode, unallocated_amount)
- `payment_allocations` — bridge table linking payments to invoices (M:N)

**Atomic Payment Workflow (single transaction):**
1. INSERT payment (status = 'received', unallocated_amount = full amount)
2. For each invoice: INSERT payment_allocation, UPDATE invoice amount_paid/due/status
3. Update payment status (fully_allocated / partially_allocated)
4. INSERT customer_ledger (entry_type = 'payment', credit = allocated_total)
5. UPDATE customers.total_due -= allocated_total

**Key Logic:**
- Payment is decoupled from invoices — record money first, then allocate
- Supports: full payment, partial payment, advance payment
- Advance credit stays in `payments.unallocated_amount`
- Payment modes: cash, upi, card, bank_transfer, cheque

**Outcome:** Robust payment system supporting real-world Indian retail scenarios.

---

### Sprint 8: Ledger System (Backend)

**Objective:** Complete the financial backbone — customer ledger with running balances.

**Scope — Backend APIs:**
- `GET /api/v1/customers/:id/ledger` — chronological ledger entries (paginated)
- `GET /api/v1/customers/:id/balance` — current balance + summary
- `POST /api/v1/ledger/adjust` — manual ledger adjustment (admin only)

**Database Tables:**
- `customer_ledger` — append-only debit/credit entries with running_balance
- `ledger_snapshots` — daily closing balance per customer (generated by nightly job)

**Key Logic:**
- Ledger is append-only — never update or delete entries
- `running_balance = previous_entry.running_balance + debit - credit`
- Positive balance = customer owes money
- `customers.total_due` must always match latest `running_balance`
- Integrity verification: `SUM(debit) - SUM(credit)` must equal `total_due`
- Nightly job generates `ledger_snapshots` for fast historical queries

**Outcome:** Reliable, auditable accounting backbone.

---

### Sprint 9: Purchase & Expense Management (Backend)

**Objective:** Complete the stock-in and expense tracking APIs.

**Scope — Backend APIs:**
- `POST /api/v1/purchases` — record purchase + update stock
- `GET /api/v1/purchases` — list purchases (paginated)
- `POST /api/v1/expenses` — record expense
- `GET /api/v1/expenses` — list expenses (paginated, filterable by category/date)

**Database Tables:**
- `purchases` — stock received from suppliers
- `purchase_items` — line items per purchase
- `expenses` — operating costs (rent, electricity, wages, etc.)

**Atomic Purchase Workflow:**
1. INSERT purchase + purchase_items
2. Increment inventory.total_quantity for each item
3. Create inventory_batches row (if batch tracking enabled)
4. INSERT inventory_logs (change_type = 'purchase', quantity_change = +N)

**Key Logic:**
- Purchase updates inventory.purchase_price to latest cost
- Expenses are used in profit calculation: Profit = Sales - COGS - Expenses
- Expense categories: rent, electricity, wages, packaging, transport, other

**Outcome:** Complete stock lifecycle + expense tracking.

---

### Sprint 10: Discount & Offer Engine (Backend)

**Objective:** Build advanced pricing and promotion system.

**Scope — Backend APIs:**
- `POST /api/v1/offers` — create offer
- `GET /api/v1/offers` — list offers (active/inactive)
- `PATCH /api/v1/offers/:id` — update/deactivate offer
- `DELETE /api/v1/offers/:id` — soft-delete offer

**Database Tables:**
- `offers` — all promotion types in one table

**Offer Types:**
| Type       | Logic                                    |
|------------|------------------------------------------|
| flat       | Fixed INR off item price                 |
| percentage | Percent off item price                   |
| bogo       | Buy N get M free                         |
| bundle     | Fixed price for a group of items         |

**Key Logic:**
- Billing engine auto-matches active offers during invoice creation
- Query: `WHERE is_active = true AND valid_from <= today AND valid_until >= today`
- One offer per line item — choose best (highest discount)
- Check `max_uses` before applying
- Store `offer_id` on `invoice_items` for audit trail

**Outcome:** Flexible promotion system integrated with billing engine.

---

## Phase 3: System Features (Backend)

---

### Sprint 11: Offline Sync Engine (Backend)

**Objective:** Build the sync infrastructure for offline-first operation.

**Scope — Backend APIs:**
- `POST /api/v1/sync/push` — push local changes to cloud
- `GET /api/v1/sync/pull` — pull cloud changes to local
- `GET /api/v1/sync/status` — sync queue status

**Database Tables:**
- `sync_queue` — offline change log (table_name, record_id, action, version, device_id)

**Key Logic:**
- Every local change appends to sync_queue
- Sync replays operations in `created_at` order
- Conflict strategies: server_wins (default), client_wins, manual
- Version-based conflict detection per device
- `is_synced` flag marks completed operations
- Failed syncs store `error_message` for retry/debugging

**Outcome:** Reliable offline-first system with eventual consistency.

---

### Sprint 12: Alerts & Notifications (Backend)

**Objective:** Build proactive alerting system.

**Scope — Backend APIs:**
- `GET /api/v1/alerts` — list alerts (unread first)
- `PATCH /api/v1/alerts/:id/read` — mark alert as read
- Background job: alert generator (runs every 15 minutes)

**Database Tables:**
- `alerts` — system notifications per tenant

**Alert Types:**
- `low_stock` — product below min_stock_alert threshold
- `payment_due` — customer has overdue invoices
- `high_demand` — unusual sales spike detected
- `expiry_soon` — batch nearing expiry date
- `sync_failed` — sync operation failed

**Outcome:** Intelligent alerting system.

---

### Sprint 13: Analytics & Reporting (Backend)

**Objective:** Build business intelligence APIs.

**Scope — Backend APIs:**
- `GET /api/v1/analytics/daily` — daily metrics (date range)
- `GET /api/v1/analytics/dashboard` — aggregated dashboard data
- `GET /api/v1/analytics/profit` — profit/loss calculation
- Background job: metrics aggregator (runs daily at midnight)

**Database Tables:**
- `daily_metrics` — pre-aggregated daily stats per tenant

**Metrics:**
- total_sales, total_purchases, total_expenses, total_profit
- invoices_count, new_customers_count
- Dashboard reads from `daily_metrics`, not raw tables (performance)

**Outcome:** Dashboard-ready analytics layer.

---

### Sprint 14: AI Integration (Backend + Python Service)

**Objective:** Build the AI microservice and integrate it with the ERP backend.

**Scope — Backend APIs (Node.js):**
- `POST /api/v1/ai/parse-product` — AI-based product name parsing (Growth+)
- `POST /api/v1/ai/parse-voice` — Voice billing transcript → invoice items (Enterprise)
- `POST /api/v1/ai/suggest-products` — Smart product suggestions during billing (Growth+)
- `GET /api/v1/ai/demand/:productId` — Demand prediction with trend analysis (Enterprise)
- `POST /api/v1/ai/enrich-product` — Background AI product enrichment (Growth+)
- `GET /api/v1/ai/suggestions/:productId` — Get cached AI data for a product

**Python AI Service (FastAPI):**
- `POST /ai/parse-product` — NLP-based product name normalization, category prediction, tag generation
- `POST /ai/parse-voice` — Hindi/English voice transcript parsing with catalog matching
- `POST /ai/suggest-products` — Fuzzy matching + trigram similarity for suggestions
- `GET /ai/predict-demand/:pid` — Weighted moving average + trend detection
- `POST /ai/enrich-product` — Background metadata generation for existing products
- `GET /ai/health` — Service health check

**Database Tables:**
- `product_ai_data` — AI-enriched metadata (normalized_name, tags, predictions, confidence_score)

**Granular Feature Flags (Plan Gating):**

| Feature Flag | Type | Starter | Growth | Enterprise |
|-------------|------|---------|--------|------------|
| `ai_product_entry` | toggle | ❌ OFF | ✅ ON | ✅ ON |
| `ai_smart_suggestions` | toggle | ❌ OFF | ✅ ON | ✅ ON |
| `ai_voice_billing` | toggle | ❌ OFF | ❌ OFF | ✅ ON |
| `ai_demand_prediction` | toggle | ❌ OFF | ❌ OFF | ✅ ON |

**Key Design Decisions:**
- **AI is optional and non-blocking** — core system works without it
- Backend uses **Circuit Breaker** pattern (3 failures → 60s cooldown → fallback)
- AI responses cached in `product_ai_data` for offline use
- Confidence scores tracked (0.000–1.000) for quality monitoring
- Backend calls Python service via Axios with configurable timeout (`AI_SERVICE_URL`)
- **Monorepo integration**: `npm run dev` starts both backend and AI service via Turborepo

**Outcome:** Full AI-powered ERP with product parsing, voice billing, smart search, and demand forecasting.

---

## Phase 4: Performance & Production (Backend)

---

### Sprint 15: Performance Optimisation (Backend)

**Objective:** Ensure the backend meets all performance targets.

**Scope:**
- Verify all mandatory indexes exist (30+ indexes from db.md)
- Optimise hot-path queries (barcode lookup, product search, invoice creation)
- Implement Redis caching for: settings, feature flags, plan data
- Configure BullMQ background jobs:
  - syncWorker (on trigger)
  - metricsAggregator (daily midnight)
  - ledgerSnapshot (daily midnight)
  - alertGenerator (every 15 min)
  - usageReset (monthly 1st)
- Load test critical endpoints

**Performance Targets (from SRS):**
| Operation            | Target     |
|----------------------|-----------|
| Invoice generation   | < 1 second |
| Product search       | < 200ms    |
| Barcode lookup       | < 50ms     |

**Outcome:** High-performance backend ready for production load.

---

### Sprint 16: Production Readiness (Backend)

**Objective:** Harden the backend for production deployment.

**Scope:**
- Implement structured logging (winston/pino)
- Setup health check and readiness probes
- Security hardening:
  - Rate limiting
  - Helmet.js (security headers)
  - Input sanitisation
  - SQL injection prevention (parameterised queries via Knex)
- Setup backup and recovery procedures
- Docker production configuration
- API documentation (Swagger/OpenAPI)
- End-to-end test suite for critical workflows:
  - Invoice creation → inventory update → ledger entry
  - Payment → allocation → invoice status update
  - Purchase → stock increase → log entry

**Outcome:** Production-ready, secure backend.

---

# Phase 4.5: Premium ERP Backend (Sprints 17–29)

> **Why this phase exists.** Sprints 0–16 delivered a strong billing/POS + inventory + single-sided customer ledger + offline sync + AI proxy. To compete with premium ERP/accounting suites (Marg, Tally, Vyapar, Zoho Books) and CRM platforms (Salesforce, Zoho CRM), the backend needs a true double-entry accounting core, full GST compliance, order management, advanced inventory, a CRM layer, and platform/security maturity. This phase adds all of it **before** frontend work, keeping the backend-first principle intact.
>
> **Guiding architectural decision:** introduce a real **double-entry General Ledger** as the financial source of truth. Every money event (invoice, payment, purchase, expense, return) posts a balanced journal entry inside the existing `withTransaction` helper. The existing `customer_ledger` becomes a fast subledger, not the source of truth.

---

### Sprint 17: Accounting Foundations & Tech-Debt Cleanup

**Objective:** Prepare the codebase for an accounting core and close the gaps where existing features are built but not wired.

**Scope — Backend:**
- **Money representation audit:** standardise monetary storage across invoices/payments/purchases (decision: integer paise vs `decimal`), since reports and a GL require one consistent unit.
- `settings` module + repository — `GET/PATCH /api/v1/settings` (table exists, no API today).
- `subscriptions` module + repository — `GET /api/v1/subscriptions`, plan upgrade/downgrade endpoints (table exists, no API today).
- **Audit logging:** `audit_logs` table + `auditLog` middleware capturing actor, action, entity, before/after on every mutation.
- **Wire offers into billing:** call `findBestOfferForItem` from `invoices.service` during invoice creation; increment `offers.used_count`.
- **Plan quota enforcement:** `featureGate(featureKey)` middleware that checks `tenant_overrides → plan_features → usage_tracking`; increment usage on invoice/user/branch create.
- **Fixes:** resolve `usage_tracking` column mismatch (`month_year` vs `period`), schedule the orphaned `generateSnapshot()` ledger job, remove the dead `'owner'` role from analytics routes.

**Database Tables:** `audit_logs` (+ no schema change for settings/subscriptions/usage beyond fixes).

**Outcome:** Trustworthy data layer with quotas enforced, offers applied, audit trail, and config/subscription APIs.

---

### Sprint 18: Double-Entry General Ledger

**Objective:** Build the financial backbone — a real chart of accounts and balanced journal postings.

**Scope — Backend APIs:**
- `GET /api/v1/accounts` — chart of accounts (tree)
- `POST /api/v1/accounts` — create ledger account (admin)
- `GET /api/v1/journals` — list journal entries (filter by date/account/reference)
- `POST /api/v1/journals` — manual journal entry (admin, must balance)
- `GET /api/v1/accounts/:id/ledger` — account ledger (running balance)

**Database Tables:**
- `chart_of_accounts` — account_code, name, account_type (asset/liability/income/expense/equity), parent_id, is_system
- `journal_entries` — entry_date, narration, reference_type, reference_id, status
- `journal_lines` — journal_entry_id, account_id, debit, credit

**Key Logic:**
- Seed a default chart of accounts per tenant on registration (Cash, Bank, Sales, Purchases, GST Output Payable, GST Input Credit, Accounts Receivable, Accounts Payable, Discounts, Expense accounts, Capital).
- `postJournal(tx, lines[])` service enforcing `SUM(debit) === SUM(credit)`.
- Hook existing flows to post journals: invoice (Dr AR/Cash, Cr Sales, Cr GST Output), payment (Dr Cash/Bank, Cr AR), purchase (Dr Purchases/Inventory + Dr GST Input, Cr AP/Cash), expense (Dr Expense, Cr Cash/Bank).

**Outcome:** Every financial event produces a balanced, auditable double-entry posting.

---

### Sprint 19: Accounts Payable & Supplier Payments

**Objective:** Mirror the customer (receivable) side with a full payable side for suppliers.

**Scope — Backend APIs:**
- `GET /api/v1/suppliers/:id/ledger` — supplier ledger
- `GET /api/v1/suppliers/:id/balance` — outstanding payable
- `POST /api/v1/supplier-payments` — pay a supplier, allocate to purchases
- `GET /api/v1/supplier-payments` — list supplier payments

**Database Tables:**
- `supplier_ledger` — debit/credit/running_balance per supplier
- `supplier_payments` + `supplier_payment_allocations`
- Add `total_payable` cached column to `suppliers`

**Key Logic:**
- Purchases post AP entries (Cr Accounts Payable) and a supplier-ledger debit.
- Supplier payments allocate against purchases, update `total_payable`, post GL (Dr AP, Cr Cash/Bank).

**Outcome:** Complete accounts-payable lifecycle alongside accounts-receivable.

---

### Sprint 20: Financial Statements & Reporting

**Objective:** Produce the statutory and management financial reports expected of an accounting ERP.

**Scope — Backend APIs:**
- `GET /api/v1/reports/trial-balance`
- `GET /api/v1/reports/profit-loss`
- `GET /api/v1/reports/balance-sheet`
- `GET /api/v1/reports/cash-flow`
- `GET /api/v1/reports/day-book`
- `POST /api/v1/financial-years` / `POST /api/v1/financial-years/:id/close`

**Database Tables:**
- `financial_years` — start_date, end_date, status (open/closed)
- `opening_balances` — account_id, financial_year_id, debit, credit

**Key Logic:**
- All statements derive from `journal_lines` for a date range / financial year.
- Year-end close locks the period and rolls forward closing balances as next-year opening balances.

**Outcome:** Trial Balance, P&L, Balance Sheet, Cash Flow, and Day Book backed by the GL.

---

### Sprint 21: GST Compliance & e-Invoicing

**Objective:** Make billing GST-compliant to Indian statutory standards.

**Scope — Backend APIs:**
- `GET /api/v1/gst/gstr1` — outward supplies (B2B/B2C/HSN summary)
- `GET /api/v1/gst/gstr3b` — summary return
- `POST /api/v1/invoices/:id/einvoice` — generate IRN + signed QR (via GSP adapter)
- `POST /api/v1/invoices/:id/eway-bill` — generate e-way bill

**Database / Schema changes:**
- Split tax into **CGST / SGST / IGST** on `invoices` and `invoice_items` (replace flat `tax_amount`/`gst_rate`-only model); add `place_of_supply` and interstate detection.
- `einvoice_logs` — irn, ack_no, ack_date, signed_qr, status
- `eway_bills` — eway_bill_no, valid_until, transporter, vehicle_no, status

**Key Logic:**
- Intra-state → CGST+SGST; inter-state → IGST, based on tenant state vs `place_of_supply`.
- HSN/SAC summary aggregated for GSTR-1.
- **Pluggable GSP/IRP adapter interface** with a sandbox/no-op implementation so core billing works offline; real provider configured via env.

**Outcome:** GST-correct invoices with GSTR-1/3B reports and e-invoice/e-way-bill generation.

---

### Sprint 22: Credit / Debit Notes & Returns

**Objective:** Support sales and purchase returns with correct accounting and stock reversal.

**Scope — Backend APIs:**
- `POST /api/v1/credit-notes` — sales return / adjustment against an invoice
- `GET /api/v1/credit-notes` / `GET /api/v1/credit-notes/:id`
- `POST /api/v1/debit-notes` — purchase return against a purchase
- `GET /api/v1/debit-notes` / `GET /api/v1/debit-notes/:id`

**Database Tables:**
- `credit_notes` + `credit_note_items`
- `debit_notes` + `debit_note_items`

**Key Logic:**
- Credit note: restock inventory, reverse GST output, post GL (Dr Sales Returns + Dr GST Output, Cr AR/Cash), credit customer ledger.
- Debit note: reduce stock, reverse GST input, adjust supplier ledger.
- Returns appear in GSTR-1/3B as credit/debit note sections.

**Outcome:** Full returns workflow with financially correct reversals.

---

### Sprint 23: Bank & Cash Management

**Objective:** Track money across multiple bank accounts and cash registers with reconciliation.

**Scope — Backend APIs:**
- `GET/POST /api/v1/bank-accounts`
- `GET /api/v1/cash-book` — cash register day-close
- `POST /api/v1/bank-accounts/:id/reconcile` — mark statement lines reconciled
- `GET /api/v1/bank-accounts/:id/transactions`

**Database Tables:**
- `bank_accounts` — name, account_no, ifsc, opening_balance, mapped GL account
- `cash_registers` — per branch
- `bank_transactions` — deposits/withdrawals/transfers, reconciliation status

**Key Logic:**
- Payments and expenses reference a bank account or cash register.
- Reconciliation matches recorded transactions to imported statement lines.

**Outcome:** Multi-account cash/bank tracking with reconciliation and cash book.

---

### Sprint 24: Sales & Purchase Order Management

**Objective:** Add the pre-invoice document chain expected of a full ERP.

**Scope — Backend APIs:**
- `POST /api/v1/quotations` → `POST /api/v1/quotations/:id/convert` (to sales order/invoice)
- `POST /api/v1/sales-orders` → fulfil → invoice
- `POST /api/v1/purchase-orders` → `POST /api/v1/grn` (goods receipt) → purchase
- `POST /api/v1/delivery-challans`

**Database Tables:**
- `quotations` + `quotation_items`
- `sales_orders` + `sales_order_items`
- `purchase_orders` + `purchase_order_items`
- `goods_receipts` + `goods_receipt_items`
- `delivery_challans` + `delivery_challan_items`

**Key Logic:**
- Status lifecycle per document (draft → confirmed → fulfilled/converted → closed).
- Convert actions carry line items forward and link source/target documents for audit.

**Outcome:** Quotation → Sales Order → Invoice and Purchase Order → GRN → Purchase flows.

---

### Sprint 25: Advanced Inventory & Valuation

**Objective:** Bring inventory up to premium ERP standards.

**Scope — Backend APIs:**
- `POST /api/v1/stock-transfers` — move stock between branches
- `GET/POST /api/v1/price-lists` — tiered/customer-specific pricing
- `GET /api/v1/inventory/valuation` — stock value by method
- `POST /api/v1/units` + UoM conversions

**Database Tables:**
- `stock_transfers` + `stock_transfer_items`
- `price_lists` + `price_list_items`
- `units` + `uom_conversions`
- `product_serials` — serial/IMEI tracking
- Add `reorder_level` / `reorder_quantity` to `inventory`

**Key Logic:**
- Wire `inventory_batches` (FEFO) into billing consumption (currently unused).
- Stock valuation methods: FIFO / weighted-average (currently only latest cost).
- Reorder alerts + auto purchase-order suggestions.

**Outcome:** Batch-aware, multi-UoM, multi-price-list inventory with valuation and reorder automation.

---

### Sprint 26: CRM Core — Leads & Pipeline

**Objective:** Add the Salesforce-style sales pipeline on top of the customer base.

**Scope — Backend APIs:**
- `GET/POST /api/v1/leads`
- `GET/POST /api/v1/opportunities`
- `PATCH /api/v1/opportunities/:id/stage` — move through pipeline
- `GET/POST /api/v1/activities` — tasks, calls, follow-ups

**Database Tables:**
- `leads` — source, status, owner
- `opportunities` — value, stage, expected_close, customer/lead link
- `pipeline_stages` — configurable stages per tenant
- `activities` — type (task/call/meeting/note), due_at, assigned_to, related entity

**Key Logic:**
- Lead → opportunity → customer conversion.
- Activity timeline attached to any entity (lead/opportunity/customer).

**Outcome:** Working CRM pipeline with leads, opportunities, stages, and activity tracking.

---

### Sprint 27: Customer Engagement & Communication

**Objective:** Reach customers proactively and reward loyalty.

**Scope — Backend APIs:**
- `GET/POST /api/v1/segments` — customer segmentation
- `GET/POST /api/v1/campaigns` — bulk messaging campaigns
- `POST /api/v1/notifications/send` — transactional email/SMS/WhatsApp
- `GET /api/v1/customers/:id/loyalty` — points balance and history

**Database Tables:**
- `customer_segments` + `segment_members`
- `campaigns` + `communication_logs`
- `message_templates`
- `loyalty_accounts` + `loyalty_transactions`

**Key Logic:**
- Pluggable providers: email (SMTP), SMS (gateway), WhatsApp (Cloud API) behind a `NotificationService` interface.
- Templated messages (payment reminders, invoices, offers); loyalty points earned per sale, redeemable at billing.

**Outcome:** Multi-channel communication, campaigns, and a loyalty program.

---

### Sprint 28: RBAC & Auth Hardening

**Objective:** Replace the two-role model with granular access control and complete the auth surface.

**Scope — Backend APIs:**
- `GET/POST /api/v1/roles` — custom roles
- `GET /api/v1/permissions` — permission registry
- `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`
- `POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password`, `POST /api/v1/auth/change-password`
- `POST /api/v1/auth/2fa/enable` / `verify`

**Database Tables:**
- `roles` + `permissions` + `role_permissions`
- `refresh_tokens`
- `password_resets`

**Key Logic:**
- Permission-matrix middleware `can('invoice:create')` replacing hardcoded `admin`/`cashier` checks.
- Refresh-token rotation, password reset via OTP/email, optional TOTP 2FA.

**Outcome:** Enterprise-grade RBAC and a complete authentication system.

---

### Sprint 29: Platform, Integrations & Observability

**Objective:** Ship the integration, billing, and operational maturity expected of a SaaS platform.

**Scope — Backend:**
- **Public API + webhooks:** `api_keys` issuance, `webhooks` subscriptions, `webhook_deliveries` with retry.
- **OpenAPI/Swagger** documentation for every endpoint.
- **SaaS subscription billing:** payment-gateway integration (Razorpay/Stripe) for tenant plan payments.
- **File/document storage:** product images, invoice/attachment uploads (S3-compatible or local).
- **Document generation:** server-side PDF (invoices, reports) and Excel export.
- **Sync apply worker:** consume `sync_queue` and apply payloads to domain tables (today sync only queues).
- **Observability + tests:** metrics/tracing, structured error tracking, and an automated test suite (restore/author `api-testing/` + unit/integration tests).

**Database Tables:**
- `api_keys`, `webhooks`, `webhook_deliveries`, `files`, `notifications`

**Outcome:** Integration-ready, documented, billable, observable, and tested platform.

---

## Phase 4.5 Summary

| Sprint | Focus | Premium-ERP Capability |
|--------|-------|------------------------|
| 17 | Accounting foundations & cleanup | Quotas, audit log, offers wired, settings/subscriptions APIs |
| 18 | Double-entry General Ledger | Chart of accounts + balanced journals |
| 19 | Accounts Payable | Supplier ledger + supplier payments |
| 20 | Financial statements | Trial Balance, P&L, Balance Sheet, Cash Flow |
| 21 | GST compliance & e-invoicing | CGST/SGST/IGST, GSTR-1/3B, IRN, e-way bill |
| 22 | Credit/Debit notes & returns | Sales & purchase returns |
| 23 | Bank & cash management | Multi-account tracking + reconciliation |
| 24 | Order management | Quotation/SO/PO/GRN/Delivery challan |
| 25 | Advanced inventory & valuation | FEFO, FIFO/WAC, multi-UoM, price lists, serials |
| 26 | CRM core | Leads, opportunities, pipeline, activities |
| 27 | Engagement & communication | Segments, campaigns, email/SMS/WhatsApp, loyalty |
| 28 | RBAC & auth hardening | Custom roles/permissions, refresh/reset/2FA |
| 29 | Platform & integrations | Public API, webhooks, billing, PDF/Excel, sync worker, tests |

---

# Phase 4.6: Offline Resilience, Drafts & Onboarding (Sprints 30–32)

> **Why this phase exists.** Real retail-floor use exposes gaps that go beyond accounting: salesmen write quick "chits" (drafts) before a formal GST bill exists, offline devices must not double-sell the same stock, new shops need bulk data onboarding, and an offline-first product must resist clock tampering and license abuse while running without internet. This backend phase hardens those paths. The matching frontend/Electron work (offline PIN login, AI search fallback, local SQLite bridge, raw ESC/POS printing) lands inside Phase 5.

---

### Sprint 30: Draft "Chit" Invoices & Soft Reserve

**Objective:** Let floor salesmen raise informal draft bills (chits) and reserve stock to prevent offline double-selling, without burning formal GST invoice numbers.

**Scope — Backend APIs:**
- `POST /api/v1/invoices` with `is_draft: true` — create a draft (no sequence lock)
- `POST /api/v1/invoices/:id/finalize` — convert a draft into a formal invoice
- `GET /api/v1/invoices?status=draft` — list open chits

**Schema changes:**
- `invoices.invoice_number` → nullable (drafts don't consume the GST sequence)
- `invoices.status` → add `'draft'`
- `invoices.token_number` (string, nullable) — daily physical chit token (e.g. `T-405`), resets daily
- `invoice_items.is_reserved` (boolean, default false)
- `inventory_logs.change_type` → add `'reserved'`

**Key Logic:**
- **Draft:** skip `invoice_sequences` lock; `status='draft'`; generate a daily `token_number`; decrement `inventory.total_quantity` but write `inventory_logs` with `change_type='reserved'`; **skip** `customer_ledger`.
- **Finalize:** lock sequence → formal `INV-XXXX`; convert the `reserved` logs into `sale`; post amounts to `customer_ledger` and `total_due`.
- **Cancel draft:** release reserved stock (reverse the `reserved` logs).

**Outcome:** Quick chits with soft stock reservations that convert atomically into GST-compliant invoices.

---

### Sprint 31: Bulk Onboarding Import & Additive Inventory Sync

**Objective:** One-shot CSV onboarding for new shops, and financially correct multi-branch offline stock convergence.

**Scope — Backend APIs:**
- `POST /api/v1/imports/products` — multipart CSV
- `POST /api/v1/imports/customers` — multipart CSV
- Refinement of the Sprint 29 sync-apply worker (`sync.worker.ts`)

**Key Logic:**
- New `imports` module using `csv-parser` / `fast-csv` on `multipart/form-data`.
- Entire batch runs inside a single DB transaction — **any** row failing validation rolls back the whole batch; return a per-row error report.
- **Additive inventory conflict resolution:** do **not** use `server_wins` for `inventory.total_quantity`. The sync worker replays each device's `inventory_logs.quantity_change` deltas, so if Branch A sells 1 and Branch B sells 1 offline, cloud stock is reduced by 2 (not overwritten).

**Outcome:** Instant onboarding plus correct additive stock math across offline branches.

---

### Sprint 32: Offline Security & Licensing

**Objective:** Make offline operation tamper-resistant with a signed license and a monotonic clock guard.

**Scope — Backend / lib:**
- `src/lib/license-security.ts` guard invoked before any offline write (e.g. `createInvoice`)
- New `settings` system keys: `offline_license` (signed JWT), `last_timestamp` (monotonic watermark)
- `users.offline_pin_hash` (bcrypt) for offline cashier authentication

**Key Logic (checks run in order):**
- **Anti-time-travel:** read `last_timestamp`; if `Date.now() < last_timestamp` → `SECURITY_LOCKDOWN` (clock tampered). Otherwise update the watermark to `Date.now()`.
- **Verify license:** decode `offline_license` JWT with the public key; invalid signature → `SECURITY_LOCKDOWN`.
- **Expiry:** `Date.now() > jwt.valid_until` → `LICENSE_EXPIRED` (requires sync).
- **Volume:** `local_invoice_count > jwt.max_offline_invoices` → `QUOTA_EXCEEDED`.

**Outcome:** Hardened offline licensing that resists clock tampering and enforces sync cadence + offline quotas.

---

## Phase 4.6 Summary

| Sprint | Focus | Capability |
|--------|-------|------------|
| 30 | Draft "Chit" invoices & soft reserve | Drafts, daily tokens, reserved stock, atomic finalize |
| 31 | Bulk import & additive sync | CSV onboarding (txn rollback), additive multi-branch stock |
| 32 | Offline security & licensing | Monotonic clock, signed JWT license, offline quotas |

---

# DhanLekha — Extended Frontend Sprint Plan
## Phase 5: Frontend (Sprints 33–41)

> Backend is complete through Sprint 32. All APIs are live, tested, and production-ready.
> All types come from `@dhanlekha/shared/types`. All HTTP via `@dhanlekha/shared/api`.
> Product landing page is Sprint 41 — last, intentionally, after all core UI is stable.

---

## Frontend Development Rules (Applies to All Sprints)

1. **Types from `@dhanlekha/shared/types` only** — never re-declare API types locally
2. **HTTP via `@dhanlekha/shared/api` only** — never create a new Axios instance
3. **API calls inside hooks only** — never call `api.get()` directly in a component
4. **React Hook Form + Zod for every form** — no uncontrolled inputs
5. **Server-side numbers are authoritative** — never calculate totals in UI
6. **Keyboard-first on billing and inventory screens**
7. **Loading, error, and empty states required on every data screen**
8. **Role-based rendering** — `isAdmin` check before every admin-only element
9. **`SyncIndicator` is in the shell layout** — not repeated per page
10. **Soft deletes only** — DELETE calls go to API, which handles soft delete

---

## Sprint 33: Foundation & Auth Shell

**Objective:** Initialize the Next.js frontend, connect to backend, build auth flow.

**Outcome:** Running app with login/register, protected routes, sidebar shell, and sync indicator.

### Tasks

#### 33.1 Project initialization
- Initialize Next.js 14 (App Router) in `/apps/frontend`
- Configure TypeScript strict mode
- Install and configure Tailwind CSS
- Install shadcn/ui and initialize component library
- Install: `zustand`, `react-hook-form`, `@hookform/resolvers`, `zod`, `recharts`, `lucide-react`
- Configure path aliases: `@/*` → `./src/*`
- Configure `@dhanlekha/shared` workspace import

#### 33.2 Shared API setup
- Verify `@dhanlekha/shared/api` Axios instance works from frontend
- Configure `NEXT_PUBLIC_API_BASE_URL` env variable
- Test JWT interceptor — confirm token attaches on requests
- Test 401 interceptor — confirm redirect to `/login` on token expiry

#### 33.3 Auth store & pages
```
Screens to build:
  /login          — email + password form, JWT stored in auth.store
  /register       — shop name, phone, GST, owner name, password
```
- Build `auth.store.ts` (Zustand) — stores JWT, user object, role
- Build `useAuth()` hook — login, logout, isAdmin, isCashier, isAuthenticated
- Build login page — RHF + Zod validation, error display, loading state
- Build register page — full tenant + admin user form
- API calls: `POST /api/v1/auth/login`, `POST /api/v1/auth/register`
- Redirect to `/dashboard` on success, `/login` on 401

#### 33.4 App shell layout
```
Layout: (app)/layout.tsx
  ├── Sidebar (nav links, shop name, plan badge, user role)
  ├── Header (page title, alerts bell, user menu)
  ├── SyncIndicator (always visible — online/offline/pending dot + count)
  └── Main content area
```
- Protected route guard — redirect unauthenticated users to `/login`
- Role-aware sidebar — cashier sees: Billing, Invoices, Customers. Admin sees all.
- `SyncIndicator` — green (online + synced), yellow (pending items), red (offline)
- Unread alerts badge on bell icon

#### 33.5 Electron wrapper
- Configure Electron 30 to load Next.js dev server in development
- Configure Electron to load built Next.js in production
- Set up `preload.ts` with context bridge for: `printInvoice`, `triggerSync`, `onSyncComplete`
- Disable browser devtools in production build

#### 33.6 SQLite IPC bridge (bypass the 5MB localStorage limit)
- In `apps/electron/main.ts`, instantiate `better-sqlite3` for the local DB
- In `apps/electron/preload.ts`, expose a secure bridge:
  `contextBridge.exposeInMainWorld('db', { query: (sql, params) => ipcRenderer.invoke('db-query', sql, params) })`
- Refactor the Zustand persistence layer to read/write via `window.db` instead of `localStorage` (handles GBs of offline data)

#### 33.7 Offline authentication lifecycle
- When online, hash a 4-digit cashier "Offline PIN" and store it in local SQLite (`users.offline_pin_hash`)
- On boot, if Axios intercepts `ERR_NETWORK`, run the license-security check (Sprint 32)
- If the license is valid, present the "Offline PIN" screen instead of `/login`
- Set an `isOfflineMode` flag in Zustand to disable cloud-only UI elements

#### 33.8 Raw hardware printing (ESC/POS)
- In `apps/electron/printer.ts`, use `electron-pos-printer` / `escpos` to bypass the OS print spooler (Dot Matrix + Thermal)
- Format invoice JSON into raw ESC/POS byte commands (align, bold, line feed)
- Include the Cash Drawer Kick command (`[0x1B, 0x70, 0x00, 0x19, 0xFA]`)
- Expose `window.electron.printRaw(buffer)` in `preload.ts` for the frontend to trigger

---

## Sprint 34: Dashboard & Analytics

**Objective:** Build the business intelligence home screen.

**Outcome:** Dashboard with live KPI cards, daily sales chart, top products, and P&L summary.

```
Screens:
  /dashboard      — KPI cards, charts, top products, recent alerts
  /analytics      — full analytics with date range picker and detailed charts
```

### Tasks

#### 34.1 Dashboard page
- Build `useAnalytics()` hook
  - `GET /api/v1/analytics/dashboard` — aggregated metrics
  - `GET /api/v1/analytics/daily` — time-series for chart
  - `GET /api/v1/analytics/profit` — P&L for date range
- Build `MetricCard` component — title, value (₹ or count), trend % vs yesterday, icon
- Build 4 KPI cards: Today's Sales, Today's Profit, Invoices Today, Pending Udhaar
- Build `SalesChart` — Recharts LineChart, last 30 days, daily sales line

#### 34.2 Analytics page (full)
- Date range picker (last 7d / 30d / 90d / custom)
- Sales vs Purchases vs Expenses stacked bar chart (Recharts BarChart)
- P&L table — revenue, COGS, expenses, net profit
- Top 10 selling products table — product name, units sold, revenue
- New customers trend line

#### 34.3 Alerts integration
- Build `useAlerts()` hook — `GET /api/v1/alerts`
- Recent 5 unread alerts on dashboard
- `PATCH /api/v1/alerts/:id/read` on click

---

## Sprint 35: Product Management & Inventory

**Objective:** Full product catalogue and stock management UI.

**Outcome:** Products list, create/edit product, inventory levels, adjustments, low stock alerts.

```
Screens:
  /products       — searchable product list with stock levels
  /products/new   — add product form
  /products/[id]  — view/edit product detail
  /inventory      — stock levels per branch, adjustments
```

### Tasks

#### 35.1 Products list
- Build `useProducts()` hook
  - `GET /api/v1/products` — paginated, searchable by name/barcode/category
  - `POST /api/v1/products` — create product + initial inventory
  - `PUT /api/v1/products/:id` — update
  - `DELETE /api/v1/products/:id` — soft delete
- Build `ProductTable` — columns: name, category, barcode, unit, GST%, stock, selling price, actions
- `StockBadge` — green (above alert), yellow (near alert), red (below alert / out)
- Search input with 300ms debounce — calls API on change
- Category filter dropdown
- "Add Product" button (admin only)

#### 35.2 Product form
- Fields: name, category (select/create), barcode (with scanner detect), unit, GST rate, selling price, purchase price, min stock alert, initial quantity
- Barcode field — manual entry OR scanner input auto-detected
- Zod validation schema
- On submit: `POST /api/v1/products`

#### 35.3 Inventory screen
- Build `useInventory()` hook
  - `GET /api/v1/inventory` — branch-scoped stock levels
  - `PATCH /api/v1/inventory/:productId` — manual adjustment
  - `GET /api/v1/products/low-stock` — below threshold items
- Low stock list with quantity and alert threshold
- Manual stock adjustment modal — reason (required), quantity change (+/-)
- Inventory log not shown in UI (backend audit only)

---

## Sprint 36: Billing Engine UI (Critical)

**Objective:** Build the primary value screen — the billing/invoice creation UI.

**Outcome:** Full billing screen with product search, barcode scanner, cart, offers, payment capture, and invoice print.

```
Screen:
  /billing        — primary billing screen (most used screen in the app)
```

**This is the most keyboard-intensive screen. All interactions must work without a mouse.**

### Tasks

#### 36.1 Billing screen layout
```
Layout:
  ┌─────────────────────────────────┬───────────────────────┐
  │  Customer selector (F4)          │  Cart / Line items     │
  │  Product search (F2)             │  (quantity editable)   │
  │  Barcode auto-capture            │                        │
  │                                  │  Subtotal, GST         │
  │  Product search results          │  Discount (offers)     │
  │  (keyboard navigable list)       │  Final amount          │
  │                                  │  [F8 Payment] [F9 Save]│
  └─────────────────────────────────┴───────────────────────┘
```

#### 36.2 Product search & cart
- Build `useBilling()` hook wrapping `useBillingStore`
- `ProductSearch` component — real-time search as user types (300ms debounce)
- Barcode scanner detection (rapid keystrokes < 100ms → barcode mode)
- `GET /api/v1/products/barcode/:code` — fast lookup on scan
- `GET /api/v1/products?search=X` — search by name
- Add product to cart → updates `billing.store`
- `BillingCart` — editable quantity column, remove row (Del key), unit price, GST, line total
- Keyboard navigation through search results (arrow keys + Enter)
- **AI suggestion fallback (circuit breaker)** in `useProductSearch.ts`:
  - Attempt `POST /api/v1/ai/suggest-products` with a strict ~2000ms timeout
  - On timeout / failure / network error, catch silently (no red error toast)
  - Instantly fall back to a local SQLite query (`LIKE '%search%'` / trigram) via the `window.db` bridge

#### 36.3 Offers & discounts
- On item add: `GET /api/v1/offers?applies_to=product&applies_to_id=X` — check active offers
- `OfferBadge` — shows applied offer name and discount amount
- Offer applied automatically; can be manually removed
- Invoice summary updates on offer apply

#### 36.4 Invoice summary panel
- Display (all from store — never calculated in UI):
  - Subtotal, GST amount, Discount, **Final Amount**
- Note field (optional)
- Payment capture: amount paid (₹ input), payment mode (Cash/UPI/Card/Credit)
- Change due display (if cash paid > final)

#### 36.5 Invoice submission
- Build `useInvoices()` create flow
- `POST /api/v1/invoices` — send full cart as payload (supports `is_draft` for chit mode → Sprint 30)
- On success: show invoice number, offer print option, clear cart
- `window.electron.printRaw(buffer)` for raw ESC/POS thermal/DMP printing + cash-drawer kick (Sprint 33.8)
- `window.electron?.printInvoice(invoiceId)` for OS-spooler Electron print
- `window.print()` fallback for browser

#### 36.6 Keyboard shortcuts
- Register all billing shortcuts via `lib/keyboard.ts`
- F2 → focus product search, F4 → focus customer search
- F8 → open payment modal, F9 → submit invoice, Escape → close modal

---

## Sprint 37: Customers, Ledger & Payments

**Objective:** Full CRM and financial management — customer profiles, udhaar tracking, payment recording.

**Outcome:** Customer list, ledger view, payment recording, payment allocation screen.

```
Screens:
  /customers              — searchable customer list with balance badges
  /customers/[id]         — customer profile (invoices, balance, contact)
  /customers/[id]/ledger  — full chronological ledger
  /payments               — payment list + record payment form
```

### Tasks

#### 37.1 Customer management
- Build `useCustomers()` hook
  - `GET /api/v1/customers` — paginated, search by name/phone
  - `POST /api/v1/customers` — add customer
  - `PATCH /api/v1/customers/:id` — edit
  - `DELETE /api/v1/customers/:id` — soft delete
- `CustomerCard` — name, phone, `BalanceBadge` (red if due > 0, green if cleared)
- Customer detail page — profile, total due, credit limit, recent invoices

#### 37.2 Customer ledger
- Build `useLedger()` hook
  - `GET /api/v1/customers/:id/ledger` — paginated entries
  - `GET /api/v1/customers/:id/balance` — current balance
  - `POST /api/v1/ledger/adjust` — manual adjustment (admin only)
- `LedgerTable` — date, type (invoice/payment/adjustment), debit, credit, running balance
- Color code: debits in red, credits in green
- Running balance always shows — never hide the total due

#### 37.3 Payments
- Build `usePayments()` hook
  - `POST /api/v1/payments` — record payment
  - `GET /api/v1/payments` — list
  - `POST /api/v1/payments/:id/allocate` — allocate advance
- Payment form — customer select, amount, mode (cash/UPI/card), reference note
- Invoice allocation UI — if customer has multiple unpaid invoices, show checklist to allocate payment

---

## Sprint 38: Suppliers, Purchases & Expenses

**Objective:** Supply chain and operating cost management.

**Outcome:** Supplier management, purchase recording (stock-in), expense logging.

```
Screens:
  /suppliers      — supplier list + add supplier form
  /purchases      — purchase history + record new purchase
  /expenses       — expense list + add expense
```

### Tasks

#### 38.1 Suppliers
- Build `useSuppliers()` hook — CRUD
- Supplier list with search, GST number column
- Add supplier form — name, phone, address, GST number

#### 38.2 Purchases (stock-in)
- Build `usePurchases()` hook
  - `POST /api/v1/purchases` — record stock-in
  - `GET /api/v1/purchases` — history
  - `GET /api/v1/purchases/:id` — detail
- Purchase form — supplier select, date, product rows (product + qty + purchase price)
- Add multiple items per purchase (same cart pattern as billing)
- On submit: inventory auto-incremented by backend, confirm with stock preview

#### 38.3 Expenses
- Build `useExpenses()` hook
  - `POST /api/v1/expenses` — record expense (admin only)
  - `GET /api/v1/expenses` — list with filters
  - `DELETE /api/v1/expenses/:id` — soft delete
- Expense form — category (rent/electricity/wages/transport/other), amount, payment mode, note
- Expense list — date filter, category filter, total for period

---

## Sprint 39: Offers, Alerts, Staff & Settings

**Objective:** Promotion management, notification center, user management, shop settings.

**Outcome:** Offer CRUD, alert inbox, staff management, tenant settings.

```
Screens:
  /offers         — offer list + create offer (admin only)
  /alerts         — alert inbox with mark-as-read
  /staff          — user/staff management (admin only)
  /settings       — shop profile, invoice prefix, plan info
```

### Tasks

#### 39.1 Offers management
- Build `useOffers()` hook — full CRUD
- Offer list — columns: name, type, discount, scope, valid dates, uses, active status
- Create offer form — type select (flat/percentage/bogo/bundle), discount value, applies_to, date range
- Offer type explains dynamically based on selection
- Toggle active/inactive without deleting

#### 39.2 Alert center
- `useAlerts()` hook — `GET /api/v1/alerts?is_read=false`
- Alert list — type icon (warning for low stock, bell for payment due, info for others), message, timestamp
- Mark read on click — `PATCH /api/v1/alerts/:id/read`
- Badge count updates in header bell icon

#### 39.3 Staff management (admin only)
- `GET /api/v1/users` — list staff
- `POST /api/v1/users` — add cashier or admin
- `DELETE /api/v1/users/:id` — deactivate staff (soft delete)
- Role badge — admin (indigo), cashier (gray)
- Cannot delete own account

#### 39.4 Settings
- Tenant profile — shop name, phone, GST number, address (PATCH /api/v1/tenants/me)
- Invoice prefix — updates via settings endpoint
- Current plan display — plan name, features, expiry
- Upgrade plan CTA (links to billing portal — outside app scope for now)

---

## Sprint 40: Sync, Offline & Invoice History

**Objective:** Offline-first experience, sync management, full invoice history.

**Outcome:** Sync status screen, offline queue management, invoice history with search and print.

```
Screens:
  /sync           — sync status, queue length, device list, manual trigger
  /invoices       — invoice history (list, filter, search, cancel)
  /invoices/[id]  — invoice detail with print
```

### Tasks

#### 40.1 Sync screen
- Build `useSync()` hook
  - `GET /api/v1/sync/status` — queue health
  - `GET /api/v1/sync/queue` — pending items (admin only)
  - `GET /api/v1/sync/devices` — registered devices
  - `POST /api/v1/sync/push` — manual push trigger
  - `GET /api/v1/sync/pull` — manual pull trigger
- Sync status card — online/offline indicator, pending item count, last sync timestamp
- Manual sync trigger button
- Pending queue list (table of table_name, action, created_at)
- Registered devices list

#### 40.2 Offline mode behavior
- All read data cached in Zustand (persist to localStorage via `zustand/middleware/persist`)
- When offline: show stale data with "Last updated X ago" badge
- Write operations queue locally (via sync queue API when back online)
- Graceful degradation — never crash on network failure, always show error state

#### 40.3 Invoice history
- `useInvoices()` hook — list with filters
  - Filter: status (all/paid/partial/unpaid/cancelled), date range, customer search
  - Pagination — 20 per page
- `StatusBadge` — paid (green), partial (yellow), unpaid (red), cancelled (gray)
- Invoice detail page — full breakdown: items, offers applied, payment history, amounts
- Print button — `window.electron?.printInvoice(id)` / `window.print()`
- Cancel invoice — `DELETE /api/v1/invoices/:id` with confirmation dialog (admin only)

---

## Sprint 41: Product Landing Page

**Objective:** Build the public-facing marketing website for DhanLekha.

> **Why last:** This page needs real screenshots, screen recordings, and finalized
> feature copy — all of which require the full app to be working and polished.
> Building it last ensures everything shown is real and accurate.

**Outcome:** Production-ready marketing site with hero, features, pricing, and CTA.

```
Pages (separate Next.js route group or separate app):
  /                   — Hero + value proposition + social proof
  /features           — Full feature breakdown with real screenshots
  /pricing            — 3-tier plan cards with feature comparison table
  /contact            — Simple contact / demo request form
```

### What this sprint requires before starting:
- [ ] All app screens are built and polished (Sprints 33–40 complete)
- [ ] Real screenshots captured from working app
- [ ] Screen recording of billing flow (voice + barcode)
- [ ] Copy finalized (feature names, pricing, taglines)
- [ ] Design tokens from `design.md` applied consistently

### Tasks
- Hero section — headline, subheadline, CTA button (Get Started Free), app screenshot
- Feature section — 6 feature cards with real screenshots: Billing, Inventory, Udhaar, AI, Analytics, Offline
- Social proof — "Built for Indian SMBs" stats (if available)
- Pricing section — 3 plan cards (Starter/Growth/Enterprise) with feature gate table
- Demo CTA section — "See it in action" with embedded video or screenshot carousel
- Footer — links, copyright, contact
- Mobile responsive

---

## Phase 5 Summary

| Sprint | Focus                         | Screens Built                                       |
|--------|-------------------------------|-----------------------------------------------------|
| 33     | Foundation, Auth, Shell        | Login, Register, App layout + Sync indicator, SQLite IPC bridge, Offline PIN, ESC/POS printing |
| 34     | Dashboard & Analytics          | Dashboard, Analytics (charts + P&L)                |
| 35     | Products & Inventory           | Product list, Product form, Inventory + adjustments|
| 36     | Billing Engine UI 🔑           | Billing screen (cart, scanner, offers, AI fallback, payment, raw print) |
| 37     | Customers, Ledger, Payments    | Customers, Ledger, Payment recording               |
| 38     | Suppliers, Purchases, Expenses | Suppliers, Purchases, Expenses                     |
| 39     | Offers, Alerts, Staff, Settings| Offers, Alerts, Staff, Settings                    |
| 40     | Sync, Offline, Invoice History | Sync screen, Invoice history, Offline mode         |
| 41     | Product Landing Page 🚀        | Marketing site (last — needs real screenshots)     |

---

## Complete Roadmap Summary

| Phase     | Sprints  | Status    | Focus                                              |
|-----------|----------|-----------|----------------------------------------------------|
| Phase 1   | 0–2      | ✅ Done   | Backend infrastructure, auth, SaaS                |
| Phase 2   | 3–10     | ✅ Done   | Core ERP backend (products, billing, payments)     |
| Phase 3   | 11–14    | ✅ Done   | System features (sync, alerts, analytics, AI)      |
| Phase 4   | 15–16    | ✅ Done   | Performance, security, production hardening        |
| Phase 4.5 | 17–29    | ⬜ Planned | Premium ERP backend (accounting, GST, orders, CRM, platform) |
| Phase 4.6 | 30–32    | ⬜ Planned | Offline resilience, drafts/chit, bulk onboarding, licensing |
| Phase 5   | 33–40    | ⬜ Planned | Frontend — all app screens (incl. offline PIN, SQLite bridge, ESC/POS) |
| Phase 6   | 41       | ⏳ Last   | Product landing page (after app is fully polished) |

# 6. Critical Rules

1. **Backend first** — no frontend sprint (Phase 5, Sprint 33+) starts until the backend is complete through Sprint 32
2. **Axios everywhere** — all HTTP communication uses Axios (frontend → backend, backend → AI)
3. **Every API must be testable** independently before frontend consumption
4. **All billing operations are atomic** database transactions
5. **Never trust frontend calculations** — recalculate server-side
6. **tenant_id from JWT only** — never from request body
7. **Soft deletes only** — never hard delete from protected tables
8. **Ledger is append-only** — never update or delete financial records

---

# 7. Success Criteria

The system will be considered successful if it achieves:

- Accurate billing and tax calculations (GST after discount)
- Consistent inventory tracking (no negative stock, full audit trail)
- Reliable ledger balancing (SUM(debit) - SUM(credit) = total_due)
- Seamless offline operation with conflict resolution
- Fast and responsive experience (barcode < 50ms, invoice < 1s)
- All frontend-backend communication via Axios with proper interceptors

---