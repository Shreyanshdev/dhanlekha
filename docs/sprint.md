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
- `GET /api/v1/products` — list products (paginated, searchable)
- `GET /api/v1/products/barcode/:code` — barcode scanner lookup (< 50ms)
- `POST /api/v1/products` — create product + inventory row
- `PUT /api/v1/products/:id` — update product
- `DELETE /api/v1/products/:id` — soft-delete product
- `GET /api/v1/inventory` — list stock levels
- `PATCH /api/v1/inventory/:productId` — manual stock adjustment

**Database Tables:**
- `products` — catalogue (name, barcode, GST rate, unit)
- `inventory` — summary stock per product (qty, prices, min_stock_alert)
- `inventory_batches` — optional batch tracking (FEFO)
- `inventory_logs` — immutable audit trail of all stock movements

**Key Logic:**
- Product + inventory created together (product is catalogue, inventory is stock)
- Barcode lookup must use `idx_products_barcode` index
- Manual adjustments create `inventory_logs` entry (change_type = 'adjustment')
- Stock movement logging: every insert to inventory_logs is append-only, never update

**Outcome:** Complete product + inventory API with audit trail.

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

### Sprint 14: AI Integration (Backend)

**Objective:** Connect AI service to the ERP backend.

**Scope — Backend APIs:**
- `POST /api/v1/ai/parse-product` — AI-based product parsing
- `GET /api/v1/ai/suggestions/:productId` — smart product suggestions
- `GET /api/v1/ai/demand/:productId` — demand prediction

**Database Tables:**
- `product_ai_data` — AI-enriched metadata (normalized_name, tags, predictions)

**Key Logic:**
- Backend calls Python FastAPI service via **Axios**:
  ```javascript
  const aiResponse = await aiClient.post('/parse', { text: rawProductText });
  ```
- AI is optional and non-blocking — core system works without it
- AI responses cached in `product_ai_data`
- Confidence scores tracked for quality monitoring

**Outcome:** AI-assisted ERP with smart product management.

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

## Phase 5: Frontend (After Backend is Complete)

---

### Sprint 17: Frontend Setup & Axios Integration

**Objective:** Setup frontend shell and connect to backend APIs.

**Scope:**
- Initialize Next.js frontend in `/apps/frontend`
- Configure Electron desktop wrapper
- Setup shared Axios instance with:
  - Base URL configuration
  - JWT interceptor (attach token on every request)
  - 401 interceptor (auto-refresh or logout)
  - Global error handling
- Build auth pages (login/register) consuming backend APIs via Axios
- Build navigation shell and layout

**Outcome:** Frontend connected to backend via Axios with auth flow working.

---

### Sprint 18: Core UI — Billing & Inventory

**Objective:** Build the primary business screens.

**Scope:**
- Billing screen (create invoice, barcode scan, add products)
- Product management screen (CRUD)
- Inventory view (stock levels, adjustments)
- Customer management screen
- All API calls via Axios shared instance

**Outcome:** Core ERP screens functional and connected to backend.

---

### Sprint 19: Financial UI — Payments, Ledger, Reports

**Objective:** Build financial management screens.

**Scope:**
- Payment recording screen
- Customer ledger view
- Analytics dashboard (charts, daily metrics)
- Expense tracking screen
- Purchase recording screen
- All data fetched via Axios from backend APIs

**Outcome:** Complete financial UI layer.

---

### Sprint 20: Offline, Sync & Polish

**Objective:** Enable offline-first experience and final polish.

**Scope:**
- Implement local SQLite storage in Electron
- Build sync UI (status indicator, manual trigger)
- Offline queue management
- Keyboard-first navigation
- Print invoice support
- Final UI polish and responsiveness

**Outcome:** Production-ready offline-first desktop ERP application.

---

# 5. Development Phases Summary

| Phase   | Sprints  | Focus                                        |
|---------|----------|----------------------------------------------|
| Phase 1 | 0–2      | Backend infrastructure, auth, SaaS           |
| Phase 2 | 3–10     | Core ERP backend APIs (products → offers)    |
| Phase 3 | 11–14    | System features backend (sync, alerts, AI)   |
| Phase 4 | 15–16    | Backend performance & production readiness   |
| Phase 5 | 17–20    | Frontend (only after backend is complete)    |

---

# 6. Critical Rules

1. **Backend first** — no frontend sprint starts until Sprint 16 is complete
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