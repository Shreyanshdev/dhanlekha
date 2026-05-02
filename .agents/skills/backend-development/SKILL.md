---
name: backend-development
description: Guides backend implementation using Node.js/TypeScript with modular architecture, repository pattern, and best practices for the DhanLekha ERP system. Use when writing APIs, services, or backend modules.
---

# Backend Development Skill

Defines the architecture, patterns, and **mandatory rules** for all backend development in the DhanLekha ERP system.

---

## When to Use

- Writing new API endpoints or routes
- Creating services, controllers, or repositories
- Structuring backend modules
- Adding middleware or validation
- Writing database queries or transactions
- Implementing background jobs or sync logic

---

## Tech Stack

| Layer        | Technology              |
|-------------|-------------------------|
| Language    | TypeScript (strict)     |
| Runtime     | Node.js                 |
| Framework   | Express.js              |
| Local DB    | SQLite (better-sqlite3) |
| Cloud DB    | PostgreSQL              |
| Query Layer | Knex.js                 |
| Cache       | Redis                   |
| Queue       | BullMQ (Node.js + Redis)|
| Auth        | JWT + bcrypt            |
| Validation  | Zod                     |
| HTTP Client | Axios                   |
| Monorepo    | Turborepo               |
| Container   | Docker                  |

---

## Project Structure

```
/apps/backend/src/
  ├── config/
  │   ├── env.ts              # Environment variables
  │   ├── database.ts         # Knex DB connection
  │   ├── knexfile.ts         # Knex config (SQLite + PostgreSQL)
  │   └── redis.ts            # Redis client (graceful failure)
  │
  ├── middleware/
  │   ├── auth.middleware.ts           # JWT verification → sets req.user
  │   ├── authorize.middleware.ts      # Role-based access: authorize('admin')
  │   ├── errorHandler.middleware.ts   # Global error handler
  │   ├── requestLogger.middleware.ts  # Request logging
  │   └── validate.middleware.ts       # Zod validation factory
  │
  ├── repositories/                    # ⚠️ THE ONLY LAYER THAT TOUCHES THE DB
  │   ├── base.repo.ts                # Base class with tenant isolation
  │   ├── tenant.repo.ts              # Tenant queries
  │   ├── user.repo.ts                # User queries
  │   └── {entity}.repo.ts            # One repo per entity
  │
  ├── modules/
  │   ├── auth/
  │   │   ├── auth.validator.ts        # Zod schemas
  │   │   ├── auth.service.ts          # Business logic
  │   │   ├── auth.controller.ts       # Request/response handling
  │   │   └── auth.routes.ts           # Express router
  │   ├── users/
  │   ├── tenants/
  │   ├── health/
  │   └── {feature}/                   # Same 4-file pattern per module
  │
  ├── database/
  │   ├── transaction.ts               # withTransaction() helper
  │   ├── migrations/                  # Knex migrations
  │   └── seeds/                       # Knex seed data
  │
  └── utils/
      ├── errors.ts                    # Error classes (400/401/403/404/409/422)
      └── response.ts                  # Standard response helpers
```

---

## ⚠️ CRITICAL: Repository Pattern (MANDATORY)

### The Iron Rule

> **Services NEVER import `db` or `database` directly.**
> **ALL database access goes through a Repository.**

This is the single most important architectural rule in the codebase.

### Data Flow

```
Controller → Service → Repository → Knex (database)
     ↓          ↓           ↓
  req/res    business     SQL queries
  parsing    logic        tenant isolation
```

### What Goes Where

| Layer | Imports `db`? | Has business logic? | Touches `req/res`? |
|-------|:---:|:---:|:---:|
| Controller | ❌ | ❌ | ✅ |
| Service | ❌ | ✅ | ❌ |
| Repository | ✅ | ❌ | ❌ |

### BaseRepository

Every entity repository extends `BaseRepository<T>` which provides:

```typescript
class BaseRepository<T> {
  // Pass trx in constructor to lock the repo to a transaction
  constructor(tenantId: string, tableName: string, trx?: Knex.Transaction)

  getQuery()      // Tenant-scoped + is_deleted=false (DEFAULT)
  getRawQuery()   // Cross-tenant (login only, RARE)
  getInsertQuery() // Raw insert builder

  findById(id)
  findAll()
  findAllSelect(columns)  // Safe column projection
  findByIdSelect(id, columns)
  create(data)
  update(id, data)
  softDelete(id)
  count(filters)
}
```

### Creating a New Repository

```typescript
// repositories/product.repo.ts
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

  async search(query: string) {
    return await this.getQuery()
      .where('name', 'like', `%${query}%`)
      .orderBy('name');
  }
}
```

### Using a Repository in a Service

```typescript
// modules/products/products.service.ts
import { ProductRepository } from '../../repositories/product.repo';
import { NotFoundError } from '../../utils/errors';

export async function getProductByBarcode(tenantId: string, barcode: string) {
  const repo = new ProductRepository(tenantId);
  const product = await repo.findByBarcode(barcode);
  if (!product) throw new NotFoundError('Product');
  return product;
}
```

### ❌ NEVER DO THIS

```typescript
// ❌ WRONG — service directly imports db
import db from '../../config/database';
const user = await db('users').where({ id }).first();

// ❌ WRONG — controller contains business logic
if (adminCount <= 1) throw new Error('...');

// ❌ WRONG — repository contains business logic
if (user.role === 'admin') { /* business rule check */ }
```

---

## Module Structure (4-File Pattern)

Every feature module follows this exact pattern:

### 1. Validator (`{feature}.validator.ts`)
```typescript
import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(2).max(200),
  barcode: z.string().min(3).max(50),
});

// ALWAYS export the inferred type so the service doesn't use `any`
export type CreateProductInput = z.infer<typeof createProductSchema>;
```

### 2. Service (`{feature}.service.ts`)
```typescript
// ✅ Imports repositories, NOT db
import { ProductRepository } from '../../repositories/product.repo';
// ✅ Imports inferred types
import type { CreateProductInput } from './product.validator';

export async function createProduct(tenantId: string, data: CreateProductInput) {
  const repo = new ProductRepository(tenantId);
  // Business logic here
}
```

### 3. Controller (`{feature}.controller.ts`)
```typescript
export async function create(req, res, next) {
  try {
    const tenantId = req.user!.tenantId;
    const result = await service.createProduct(tenantId, req.body);
    return created(res, result);
  } catch (error) {
    next(error);
  }
}
```

### 4. Routes (`{feature}.routes.ts`)
```typescript
router.post('/', requireAuth, authorize('admin'), validate(schema), controller.create);
```

---

## Middleware Chain

```
requestLogger → requireAuth → authorize(role) → validate(schema) → controller → errorHandler
```

| Middleware | Purpose |
|-----------|---------|
| `requestLogger` | Log method, URL, status, response time |
| `requireAuth` | Verify JWT → set `req.user.userId`, `req.user.tenantId`, `req.user.role` |
| `authorize(roles)` | Check `req.user.role` is in allowed roles |
| `validate(schema)` | Zod-validate `req.body` / `req.params` / `req.query` |
| `errorHandler` | Catch all errors, format standard response |

---

## Multi-Tenant Rules

- **Every query MUST be tenant-scoped** — handled automatically by `BaseRepository.getQuery()`
- `tenant_id` comes from JWT (`req.user.tenantId`), **never from request body**
- Cross-tenant access is a **critical security bug** — only `getRawQuery()` bypasses scope (login only)
- The `tenants` and `plans` tables are global — their repos override `getQuery()`

---

## Transaction Rules (Constructor Pattern)

Use `withTransaction()` for any operation that modifies multiple tables.
**Pass `trx` to the Repository constructor** so all methods called on that repo use the same transaction.

```typescript
import { withTransaction } from '../../database/transaction';

return await withTransaction(async (trx) => {
  const productRepo = new ProductRepository(tenantId, trx);
  const inventoryRepo = new InventoryRepository(tenantId, trx);
  
  await productRepo.create(productData);   // Implicitly uses trx
  await inventoryRepo.create(invData);     // Implicitly uses trx
});
```

Required for: Invoice creation, Payment recording, Purchase recording, Stock adjustment.

---

## Sync Engine & Offline Conflicts (Sprint 11)

DhanLekha is an offline-first system. The sync engine is the most complex part of the architecture and operates outside the standard 4-file pattern.

1. **Client-side UUIDs:** All primary keys MUST be generated client-side (`uuidv4()`). Auto-increment IDs are strictly forbidden.
2. **`sync_queue` Table:** Mobile/desktop clients write mutations to a local `sync_queue`.
3. **Background Sync Worker (BullMQ):** A dedicated background worker (`src/jobs/syncWorker.ts`) replays these operations on the cloud database.
4. **Conflict Resolution:** If a record is edited offline by two different cashiers, the worker applies a Last-Write-Wins (LWW) strategy based on a `last_modified_at` timestamp attached to the payload.

*(Detailed sync documentation will be expanded during Sprint 11)*

---

## Shared Types

All TypeScript interfaces live in `packages/shared/types.ts`:

- Every entity has a **full interface** matching the DB schema (e.g., `User`)
- Sensitive entities also have a **public interface** (e.g., `UserPublic` — no `password_hash`)
- Services return the **public** interface to controllers
- Repositories may return the **full** interface for internal checks

---

## Error Handling

```typescript
class AppError extends Error { statusCode, code }
class ValidationError extends AppError { /* 400 */ }
class AuthenticationError extends AppError { /* 401 */ }
class ForbiddenError extends AppError { /* 403 */ }
class NotFoundError extends AppError { /* 404 */ }
class ConflictError extends AppError { /* 409 */ }
class BusinessRuleError extends AppError { /* 422 */ }
```

Rules:
- Never expose internal errors to client
- Use specific codes: `INSUFFICIENT_STOCK`, `CREDIT_LIMIT_EXCEEDED`, `QUOTA_EXCEEDED`
- All 500s are logged with full stack trace

---

## Checklist for New Features

- [ ] Create shared types in `packages/shared/types.ts`
- [ ] Create migration in `database/migrations/`
- [ ] Create repository in `repositories/{entity}.repo.ts` extending `BaseRepository`
- [ ] Create module with 4 files: validator, service, controller, routes
- [ ] Service imports **repository only** (never `db`)
- [ ] Wire routes in `app.ts`
- [ ] Update Postman collection in `api-testing/`
- [ ] Run `npx tsc --noEmit` — must pass with zero errors
- [ ] Test all endpoints via curl or Postman