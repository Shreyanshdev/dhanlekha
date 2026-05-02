# DhanLekha Backend Architecture Guide

Welcome to the backend of the **DhanLekha ERP System**. This guide explains the architecture, the 4-file pattern used for every module, and the strict rules we follow to keep the code scalable and maintainable.

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

