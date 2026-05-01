---
name: backend-development
description: Guides backend implementation using Node.js with modular architecture, project structure, middleware patterns, and best practices for the Antigravity ERP system. Use when writing APIs, services, or backend modules.
---

# Backend Development Skill

Defines the architecture, patterns, and rules for all backend development in the Antigravity ERP system.

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
| Runtime     | Node.js                 |
| Framework   | Express.js (or Fastify) |
| Local DB    | SQLite                  |
| Cloud DB    | PostgreSQL              |
| Cache       | Redis                   |
| Queue       | BullMQ (Node.js + Redis)|
| Auth        | JWT-based               |
| Monorepo    | Turborepo (or Nx)       |
| Container   | Docker                  |

---

## Project Structure (Monorepo)

```
/apps
  /backend          ← Node.js Express server
  /frontend         ← Next.js + Electron
  /ai-service       ← Python FastAPI

/packages
  /db               ← Database schemas, migrations, seeds
  /shared           ← Shared types, constants, utilities
  /utils            ← Helper functions
```

---

## Backend Module Structure

Each feature module follows a **layered architecture**:

```
/src
  /modules
    /products
      product.controller.js    ← Route handlers (req/res)
      product.service.js       ← Business logic
      product.repository.js    ← Database queries
      product.validator.js     ← Input validation (Joi/Zod)
      product.routes.js        ← Express router definitions
    /invoices
      invoice.controller.js
      invoice.service.js
      invoice.repository.js
      invoice.validator.js
      invoice.routes.js
    /payments
    /customers
    /inventory
    /ledger
    /auth
    /sync
    /analytics
    ...

  /middleware
    auth.middleware.js          ← JWT verification
    tenant.middleware.js        ← tenant_id injection
    featureGate.middleware.js   ← Plan/quota enforcement
    role.middleware.js          ← Role-based access
    errorHandler.middleware.js  ← Global error handler
    requestLogger.middleware.js ← Request logging

  /config
    database.js
    redis.js
    env.js

  /jobs
    syncWorker.js              ← BullMQ sync processor
    metricsAggregator.js       ← Daily metrics job
    ledgerSnapshot.js          ← Nightly ledger snapshots
    alertGenerator.js          ← Low stock / payment due alerts

  /utils
    uuid.js                    ← UUID generation (client-side compat)
    decimal.js                 ← Safe decimal arithmetic
    response.js                ← Standard response helpers

  app.js                       ← Express app setup
  server.js                    ← HTTP server start
```

---

## Layer Responsibilities

### Controller Layer
- Parse request params, body, query
- Call service layer
- Return standardised JSON response
- **Never** contain business logic or raw SQL

```javascript
// product.controller.js
async function createProduct(req, res, next) {
  try {
    const product = await productService.create(req.tenantId, req.body, req.userId);
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
}
```

### Service Layer
- Contains all business logic
- Orchestrates repository calls
- Manages transactions
- Enforces business rules (credit limits, stock checks, quota)
- **Never** access `req` or `res` directly

```javascript
// invoice.service.js
async function createInvoice(tenantId, invoiceData, userId) {
  return db.transaction(async (trx) => {
    // 1. Quota check
    // 2. Invoice number generation (SELECT FOR UPDATE)
    // 3. Line item calculation
    // 4. Inventory updates
    // 5. Ledger entry
    // 6. Usage tracking increment
  });
}
```

### Repository Layer
- Raw database queries only
- One method per query
- Always filter by `tenant_id`
- Always exclude `deleted_at IS NOT NULL` in default scope
- Returns plain data objects

```javascript
// product.repository.js
async function findByTenant(tenantId, { page, limit, search, category }) {
  return db('products')
    .where({ tenant_id: tenantId })
    .whereNull('deleted_at')
    .modify((qb) => {
      if (search) qb.where('name', 'like', `%${search}%`);
      if (category) qb.where('category', category);
    })
    .orderBy('created_at', 'desc')
    .paginate({ perPage: limit, currentPage: page });
}
```

### Validator Layer
- Validate all input before it reaches the service
- Use Joi or Zod schemas
- Return 400 with specific field errors on failure

---

## Middleware Chain

Every request passes through this middleware stack in order:

```
1. requestLogger     → Log method, URL, timestamp
2. authenticate      → Verify JWT, set req.userId
3. resolveTenant     → Set req.tenantId from user record
4. featureGate(key)  → Check plan quota (applied per-route)
5. authorize(role)   → Check req.user.role (applied per-route)
6. validate(schema)  → Validate req.body/query
7. controller        → Handle request
8. errorHandler      → Catch and format all errors
```

---

## Multi-Tenant Rules

- **Every query MUST filter by `tenant_id`** — no exceptions
- `tenant_id` comes from JWT/auth middleware, never from request body
- Cross-tenant data access is a **critical security bug**
- All repository methods take `tenantId` as first parameter
- Default query scope: `WHERE tenant_id = ? AND deleted_at IS NULL`

---

## Transaction Rules

Use database transactions for any operation that modifies multiple tables:

- **Invoice creation** — invoice + items + inventory + logs + ledger + usage
- **Payment recording** — payment + allocations + invoice updates + ledger
- **Purchase recording** — purchase + items + inventory + logs + batches
- **Stock adjustment** — inventory + logs

```javascript
await db.transaction(async (trx) => {
  // All queries inside use trx
  await trx('invoices').insert(invoiceData);
  await trx('invoice_items').insert(items);
  await trx('inventory').where({ product_id }).decrement('total_quantity', qty);
  // If any fails, entire transaction rolls back
});
```

---

## Error Handling

### Structured Error Classes

```javascript
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

class ValidationError extends AppError { /* 400 */ }
class AuthenticationError extends AppError { /* 401 */ }
class ForbiddenError extends AppError { /* 403 */ }
class NotFoundError extends AppError { /* 404 */ }
class ConflictError extends AppError { /* 409 */ }
class BusinessRuleError extends AppError { /* 422 */ }
```

### Global Error Handler

```javascript
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const response = {
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: statusCode === 500 ? 'Internal server error' : err.message
    }
  };
  if (statusCode === 500) logger.error(err); // Log full stack for 500s
  res.status(statusCode).json(response);
}
```

**Rules:**
- Never expose internal errors (stack traces, SQL errors) to client
- Log all 500 errors with full context
- Use specific error codes: `INSUFFICIENT_STOCK`, `CREDIT_LIMIT_EXCEEDED`, `QUOTA_EXCEEDED`

---

## UUID Generation

All IDs are UUIDs generated **client-side** (for offline-first):

```javascript
import { v4 as uuidv4 } from 'uuid';
const id = uuidv4();
```

Never use auto-increment IDs. The app must work without server round-trips for ID generation.

---

## Soft Deletes

Never use `DELETE FROM`. Always set `deleted_at = new Date()`:

```javascript
await trx('products')
  .where({ id, tenant_id: tenantId })
  .update({ deleted_at: new Date() });
```

Tables with soft delete: `tenants`, `users`, `customers`, `suppliers`, `products`, `invoices`, `payments`, `purchases`, `expenses`, `offers`.

---

## Background Jobs (BullMQ)

| Job                  | Schedule     | Purpose                           |
|----------------------|-------------|-----------------------------------|
| syncWorker           | On trigger  | Process sync_queue to cloud       |
| metricsAggregator    | Daily 00:00 | Generate daily_metrics rows       |
| ledgerSnapshot       | Daily 00:00 | Generate ledger_snapshots         |
| alertGenerator       | Every 15min | Check low stock, payment due      |
| usageReset           | Monthly 1st | Reset usage_tracking counters     |

---

## Performance Requirements

From SRS non-functional requirements:

- Invoice generation: **< 1 second**
- Product search: **< 200ms**
- Barcode lookup: **< 50ms** (near-instant)
- Use indexed queries (see database-enforcement skill)
- Use Redis caching for frequently accessed data (settings, feature flags)

---

## Logging

- Log all requests (method, URL, response time, status code)
- Log all errors with full stack trace
- Log all transaction boundaries (begin, commit, rollback)
- Log all sync operations
- **Never log** passwords, tokens, or sensitive customer data