# DhanLekha Backend Architecture Guide

Welcome to the backend of the **DhanLekha ERP System**. This guide explains the architecture, the 4-file pattern used for every module, and the strict rules we follow to keep the code scalable and maintainable.

---

## 📖 API Documentation (Swagger / OpenAPI)

The full REST API is documented with an OpenAPI 3.0 specification, served live by the running backend:

- **Swagger UI:** `GET /api/v1/docs` — interactive explorer (try-it-out enabled).
- **Raw spec:** `GET /api/v1/docs.json` — the OpenAPI 3.0 document (import into Postman/Insomnia/codegen).

The spec is hand-authored in `src/config/openapi.ts` and kept in lock-step with the Express
routes and Zod validators. It covers every endpoint (54 paths across 20 tags) with bearer-JWT
security, request/response schemas, path/query params, and plan/role notes. **All monetary
fields are integer paise** (₹1 = 100 paise) per the Sprint 17 money decision.

Authenticate via `POST /api/v1/auth/login`, then click **Authorize** in Swagger UI and paste the
returned JWT to exercise protected endpoints.

---

## 🏗️ The 4-File Module Pattern

Every feature in the backend (e.g., `users`, `products`, `invoices`) lives inside `src/modules/{feature}/` and follows a strict **4-file pattern**. 

The goal is **Separation of Concerns**: each layer has exactly one job.

### 1. The Route (`{feature}.routes.ts`)
**Job:** Define the API endpoints and apply middleware.
**Rules:** No logic here. Just connect the URL to the controller.

```typescript
// Example: src/modules/users/users.routes.ts
import { Router } from 'express';
import validate from '../../middleware/validate.middleware';
import { requireAuth } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import { createUserSchema } from './users.validator';
import * as controller from './users.controller';

const router = Router();

// URL           Middleware 1  Middleware 2        Middleware 3              Controller
router.post('/', requireAuth,  authorize('admin'), validate(createUserSchema), controller.createUser);

export default router;
```

### 2. The Validator (`{feature}.validator.ts`)
**Job:** Validate the incoming request body, params, or query before it reaches the controller.
**Rules:** Use **Zod**. Give clear error messages.

```typescript
// Example: src/modules/users/users.validator.ts
import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email format'),
  role: z.enum(['admin', 'cashier']),
});

// ALWAYS export the inferred type for the Service to use
export type CreateUserInput = z.infer<typeof createUserSchema>;
```

### 3. The Controller (`{feature}.controller.ts`)
**Job:** Extract data from the request (`req.body`, `req.user`), call the Service, and return the response to the user.
**Rules:** **NO BUSINESS LOGIC HERE.** Do not write any `if` statements about business rules in the controller.

```typescript
// Example: src/modules/users/users.controller.ts
import type { Request, Response, NextFunction } from 'express';
import * as service from './users.service';
import { created } from '../../utils/response';

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.tenantId; // Got this from requireAuth middleware
    
    // Call the service!
    const result = await service.createUser(tenantId, req.body);
    
    // Return standard success response
    return created(res, result);
  } catch (error) {
    next(error); // Send to global error handler
  }
}
```

### 4. The Service (`{feature}.service.ts`)
**Job:** Business logic. Checking rules, transforming data, and calling the Repository.
**Rules:** 
- **NO `db()` calls here!** You must use a Repository.
- Do not touch `req` or `res` here.
- Throw custom errors (e.g., `ConflictError`, `NotFoundError`).

```typescript
// Example: src/modules/users/users.service.ts
import { ConflictError } from '../../utils/errors';
import { UserRepository } from '../../repositories/user.repo';
import type { CreateUserInput } from './users.validator';

// Notice `data` uses the strict Zod type, NOT `any`
export async function createUser(tenantId: string, data: CreateUserInput) {
  // Pass tenantId (and optionally `trx`) to the repo constructor
  const repo = new UserRepository(tenantId);
  
  // Business logic: check for duplicate email
  const existing = await repo.findByEmail(data.email);
  if (existing) {
    throw new ConflictError('Email already exists');
  }

  // Call repo to save to database
  await repo.create({
    name: data.name,
    email: data.email,
    role: data.role
  });

  return { message: "User created" };
}
```

---

## 🗄️ The Repository Layer (`src/repositories/`)

The **Repository Pattern** is the most important rule in this codebase.

**The Iron Rule:** Services NEVER import the database (`db` or Knex) directly. ALL database access must go through a Repository.

### Why do we use Repositories?
Because DhanLekha is a **Multi-Tenant SaaS**. Every query *must* be scoped to the `tenant_id` so that Shop A can never accidentally see Shop B's data. If developers write raw SQL everywhere, they will eventually forget to add `WHERE tenant_id = ?`, causing a massive security breach.

The `BaseRepository` automatically adds `WHERE tenant_id = ?` to every query!

### How to use a Repository

Every table in the database gets its own repository that extends `BaseRepository`. By passing `trx` to the constructor, you ensure all methods in that instance use the same transaction.

```typescript
// src/repositories/product.repo.ts
import { BaseRepository } from './base.repo';
import type { Product } from '@dhanlekha/shared';
import { Knex } from 'knex';

export class ProductRepository extends BaseRepository<Product> {
  constructor(tenantId: string, trx?: Knex.Transaction) {
    super(tenantId, 'products', trx); 
  }

  async findByBarcode(barcode: string) {
    return await this.getQuery().where({ barcode }).first(); 
  }
}
```

### 📦 Consolidated Repositories (Domain Aggregates)

While we generally follow one repository per table, complex domains like **Billing** use **Consolidated Repositories** to manage multiple related tables within a single domain aggregate.

Example: **`InvoiceRepository`**
- Manages `invoices` table.
- Manages `invoice_items` table.
- Manages `invoice_sequences` table (atomic numbering).

This ensures that the `InvoicesService` only needs to interact with one domain expert for all billing data operations.

### 🏢 Multi-Branch Scoping (`BranchScopedRepository`)

For tables that must be isolated by store (e.g., `inventory`, `invoices`, `logs`), we use `BranchScopedRepository`. This automatically adds **both** `tenant_id` and `branch_id` to every query.

```typescript
// src/repositories/inventory.repo.ts
export class InventoryRepository extends BranchScopedRepository<Inventory> {
  constructor(tenantId: string, branchId: string, trx?: Knex.Transaction) {
    super(tenantId, branchId, 'inventory', trx);
  }
}
```
**Benefits:**
- Prevents cross-branch stock leakage.
- Simplifies service logic (no need to pass `branchId` to every filter).
- Ensures data integrity in multi-store setups.

### Transactions across Multiple Tables

For complex operations (like creating an Invoice), you must use a database transaction. Pass the transaction down into the repository constructors:

```typescript
import { withTransaction } from '../../database/transaction';

export async function createInvoice(tenantId: string, data: InvoiceInput) {
  return await withTransaction(async (trx) => {
    // Both repos are now locked to the same transaction
    const invoiceRepo = new InvoiceRepository(tenantId, trx);
    const inventoryRepo = new InventoryRepository(tenantId, trx);
    
    await invoiceRepo.create(data.invoice);
    await inventoryRepo.deductStock(data.items);
  });
}
```

---

## 🔄 The Request Lifecycle

When a user makes an API request, here is the exact path it takes:

1. **Request Logger** (Logs `POST /api/v1/users`)
2. **Auth Middleware** (Checks JWT, extracts `tenantId` & `userId`)
3. **Role Middleware** (Checks if the user is an `admin`)
4. **Validator Middleware** (Uses Zod to check if the body has a valid email and name)
5. **Controller** (Gets `req.body`, extracts `tenantId`, calls Service)
6. **Service** (Checks business rules, orchestrates Repositories)
7. **Repository** (Builds the Knex SQL query with `tenant_id` isolation)
8. **Database** (Executes the query)
9. *(Data flows back up)*
10. **Controller** (Uses `utils/response.ts` to send a clean JSON response)

---

## ✅ Best Practices Checklist

When you build a new feature (like Products):

1. **Types:** Add the TypeScript interface to `packages/shared/types.ts`.
2. **Migration:** Create the DB table using Knex migrations.
3. **Repo:** Create `src/repositories/product.repo.ts`.
4. **Validator:** Create Zod schemas in `product.validator.ts`.
5. **Service:** Write the business logic in `product.service.ts` (using the repo).
6. **Controller:** Write thin wrappers in `product.controller.ts`.
7. **Routes:** Wire it up in `product.routes.ts`.
8. **App:** Mount the route in `src/app.ts`.

By following this pattern, the backend will remain scalable, secure, and easy to test as it grows into a massive enterprise ERP!

---

## 🧾 Billing Engine (Sprint 5)

The Billing Engine is the most critical part of the system. It uses a **10-step atomic workflow** to ensure financial and inventory integrity:

1. **Recalculate Totals**: Never trust frontend calculations.
2. **Atomic Numbering**: Uses `SELECT FOR UPDATE` on `invoice_sequences` to generate `INV-0001`.
3. **Insert Invoice**: Saves the header with snapshotted totals.
4. **Insert Items**: Saves line items with snapshotted prices and GST rates.
5. **Decrement Stock**: Subtracts quantity from `inventory`.
6. **Audit Log**: Creates `inventory_logs` for every item sold.
7. **Ledger Update**: (If customer linked) Appends entry to `customer_ledger`.
8. **Balance Sync**: Updates `customers.total_due` (denormalized balance).
9. **Credit Check**: Blocks sale if customer exceeds their `credit_limit`.
10. **Commit**: Finalizes the transaction or rolls back everything on error.

---

## 🏛️ Accounting Foundations & Platform Hardening (Sprint 17)

Sprint 17 begins **Phase 4.5 (Premium ERP Backend)** by tightening the platform foundations
that accounting, GST, and reporting will build on. Progress is tracked in `docs/progress.md`.

### Audit Logging

Every state-changing request (`POST`/`PUT`/`PATCH`/`DELETE`) is recorded in the `audit_logs`
table by the `auditLog` middleware (`src/middleware/audit.middleware.ts`). It runs on the
response `finish` event, so it **never blocks or fails a request**:

- Skips read-only methods, unauthenticated requests, and error responses (`>= 400`).
- Derives the `entity` from the URL (`/api/v1/invoices/:id` → `invoices`) and captures
  `entity_id`, HTTP method, status code, and IP.
- Stores a secret-free body summary in `metadata` (keys like `password`/`token`/`pin` are redacted).

Writes go through `AuditLogRepository` (append-only; not soft-deletable).

### SaaS Quota Enforcement (`featureGate`)

`src/middleware/featureGate.middleware.ts` enforces plan limits at the route boundary:

```typescript
router.post('/', requireAuth, featureGate('max_invoices_per_month'), validate(schema), controller.createInvoice);
```

Resolution order mirrors the AI gate: **`tenant_overrides` first, then `plan_features`**.
- `boolean` features → blocked when disabled.
- `limit` features → blocked when the current month's usage reaches `limit_value`.

Monthly consumption is metered by `UsageRepository`, which upserts a row keyed by
`(tenant_id, feature_id, month_year)`. The invoice service increments
`max_invoices_per_month` **inside the billing transaction**, so usage and the invoice commit
atomically together. A new month naturally starts at `0` (no row yet); the monthly
`usage-reset` job simply prunes prior-month rows.

### Offers Wired Into Billing

The billing engine now auto-applies promotions. For each line it calls
`findBestOfferForItem(...)` (transaction-aware) using the **gross cart subtotal** so
min-purchase offers evaluate correctly. An offer is only applied when its discount **beats the
manually-entered discount**; when applied it stamps `invoice_items.offer_id` and increments
`offers.used_count` within the same transaction. Discounts are clamped to the line subtotal.

### Money Representation — Canonical Unit

The Sprint 17 money audit settled the storage unit: **all money is integer paise**
(₹1 = 100 paise). This already matched most of the schema (products, payments, plans, ledger
snapshots) and the `packages/shared` type comments. `src/utils/money.ts` encodes the rules:

- `roundPaise(x)` — collapse any fractional paise to a whole paise.
- `percentageOf(basePaise, rate)` — GST/percentage math, rounded to whole paise.
- `lineAmount(unitPricePaise, qty)` — quantity math, rounded to whole paise.
- `toRupees` / `toPaise` — presentation/input boundary conversions only.

The billing engine and offer engine now compute exclusively in whole paise (this also fixed a
prior bug where percentage offers rounded to *sub-paise* via `Math.round(x * 100) / 100`).
A non-destructive migration can later tighten the few DECIMAL-typed money columns to INTEGER;
they already store paise-valued numbers, so no value changes.

### Configuration & Subscription APIs

- **`GET /api/v1/settings`** / **`PATCH /api/v1/settings`** — tenant key/value config
  (`SettingRepository`). Any authenticated user can read (e.g. invoice prefix during billing);
  only admins can write.
- **`GET /api/v1/subscriptions`** — current plan, status, billing period, this month's metered
  usage vs limits, and the plan catalogue.
- **`POST /api/v1/subscriptions/change-plan`** (admin) — upgrade/downgrade: updates
  `tenants.plan_id` and the `subscriptions` record atomically. Payment-gateway wiring is
  deferred to Sprint 29.

> Note: `settings` and `subscriptions` have no `is_deleted` column, so their repositories are
> plain tenant-scoped classes rather than `BaseRepository` subclasses.

### Tech-Debt Cleanup

- **Scheduler / usage tracking:** fixed a column mismatch — the reset job queried `period`,
  but the table uses `month_year`. It now prunes stale prior-month rows.
- **Dead role removed:** analytics routes referenced a non-existent `'owner'` role; the system
  only issues `admin`/`cashier`.
- **Ledger snapshot job:** the previously orphaned `generateSnapshot()` is now driven by a daily
  (00:15) BullMQ job (`jobs/snapshots.job.ts`) that walks every tenant's customers.

---

## 🧾 Double-Entry General Ledger (Sprint 18)

Sprint 18 adds a real double-entry accounting core. Every money event now produces a
**balanced journal entry** (`SUM(debit) == SUM(credit)`), giving the system an auditable
financial backbone for the Trial Balance, P&L, and Balance Sheet coming in Sprint 20.

### Data model

- **`chart_of_accounts`** — hierarchical accounts (`account_code`, `name`, `account_type` of
  `asset|liability|income|expense|equity`, optional `parent_id`, `is_system`/`is_active`).
- **`journal_entries`** — header: `entry_date`, `narration`, `reference_type`/`reference_id`
  (links back to the invoice/payment/etc.), and `status` (`posted`/`void`).
- **`journal_lines`** — one row per debit or credit (`account_id`, `debit`, `credit` in paise;
  exactly one side is non-zero).

### Chart of Accounts

`src/accounting/coa.ts` defines stable account codes (`ACCOUNTS`) and the
`DEFAULT_CHART_OF_ACCOUNTS`. On tenant registration, `ensureChartOfAccounts` seeds the default
tree **idempotently**, so existing tenants are safe to re-run.

### `postJournal` service

`src/accounting/ledger.service.ts` is the single entry point for writing to the GL. It:

- resolves account **codes → ids** for the tenant (`resolveCodes`),
- validates each line has exactly one of debit/credit and the totals balance (non-zero), and
- writes the entry + lines inside the **caller's transaction**, so postings commit atomically
  with the business event that triggered them.

### Postings wired into money events

| Event | Debit | Credit |
| --- | --- | --- |
| Invoice | Cash/AR + Discounts | Sales + GST Output Payable |
| Payment | Cash/Bank | Accounts Receivable |
| Expense | General Expense | Cash/Bank |
| Purchase | Purchases + GST Input Credit | Accounts Payable / Cash |

### Ledger APIs

- **`GET /api/v1/accounts`** — chart of accounts as a tree.
- **`POST /api/v1/accounts`** (admin) — create a custom account.
- **`GET /api/v1/accounts/:id/ledger`** — account ledger with totals and a running balance.
- **`GET /api/v1/journals`** — list journal entries with their lines.
- **`POST /api/v1/journals`** (admin) — post a manual entry; the balance rule is enforced.

All endpoints are documented in the OpenAPI spec (`/api/docs`).

---

## ✅ Automated Tests

The backend now ships with a **Vitest + Supertest** suite (introduced alongside Sprint 17/18).

```bash
npm test            # run once (serial)
npm run test:watch  # watch mode
```

- **Isolated test DB:** `test/globalSetup.ts` builds a clean SQLite database
  (`data/test.sqlite`), runs all migrations + seeds once, and the suite runs **serially**
  (single fork, WAL, `busy_timeout`) to avoid SQLite lock contention.
- **Helpers:** `test/helpers.ts` provides `registerAndLogin`, `createProduct`,
  `createPercentageOffer`, and token/utility helpers.
- **Coverage (57 tests):** money math (`money.test.ts`), invoice money + offer auto-apply
  (`invoices.test.ts`), monthly quota enforcement (`quota.test.ts`), settings gating
  (`settings.test.ts`), subscriptions + change-plan (`subscriptions.test.ts`), audit-log writes
  and secret redaction (`audit.test.ts`), the full General Ledger (`ledger.test.ts`), and
  accounts payable / supplier payments (`supplier-payable.test.ts`).

---

## 💳 Accounts Payable & Supplier Payments (Sprint 19)

Sprint 19 mirrors the customer receivable side with a full **accounts payable** lifecycle for suppliers.

### Data model

- **`supplier_ledger`** — debit/credit/running_balance per supplier (`entry_type`: purchase | payment | adjustment).
- **`supplier_payments`** — money paid out to suppliers (amount, unallocated_amount, payment_mode, status).
- **`supplier_payment_allocations`** — links a supplier payment to one or more purchases.
- **`suppliers.total_payable`** — cached outstanding payable in paise (updated atomically with ledger writes).

### Purchase postings

When a purchase is recorded, the service writes supplier-ledger entries mirroring the customer invoice pattern:

1. **Debit** the full `total_amount` (purchase obligation).
2. **Credit** any `paid_amount` paid at purchase time.
3. Increment `total_payable` by the unpaid portion (`total_amount − paid_amount`).

The Sprint 18 GL hook (Dr Purchases + GST Input / Cr AP + Cash) is unchanged.

### Supplier payment workflow

`POST /api/v1/supplier-payments` atomically:

1. Validates supplier and purchase ownership.
2. Inserts the payment and optional allocations.
3. Updates each purchase's `paid_amount` and `payment_status`.
4. Credits the supplier ledger and reduces `total_payable`.
5. Posts GL: **Dr Accounts Payable, Cr Cash/Bank**.

Advance payments (unallocated) can be applied later via `POST /supplier-payments/:id/allocate`.

### APIs

- **`GET /api/v1/suppliers/:id/ledger`** — paginated payable ledger.
- **`GET /api/v1/suppliers/:id/balance`** — outstanding payable with computed vs cached integrity check.
- **`GET/POST /api/v1/supplier-payments`** — list and create supplier payments.
- **`GET /api/v1/supplier-payments/:id`** — payment detail with allocations.
- **`POST /api/v1/supplier-payments/:id/allocate`** — allocate an advance payment to purchases.

All endpoints are documented in the OpenAPI spec (`/api/v1/docs`).

