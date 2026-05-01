---
name: api-design
description: Defines RESTful API design standards, endpoint conventions, request/response contracts, and middleware patterns for the Antigravity ERP system. Use when creating or modifying any API endpoint.
---

# API Design Skill

This skill enforces consistent, production-grade API design across the Antigravity ERP backend (Node.js / Express or Fastify).

---

## When to Use

- Designing a new API endpoint or route
- Reviewing or modifying an existing endpoint
- Adding query parameters, filters, or pagination
- Defining request/response JSON contracts
- Implementing middleware (auth, tenant isolation, feature gating)

---

## Base URL Convention

```
/api/v1/<resource>
```

All routes are versioned. Never expose unversioned endpoints.

---

## HTTP Method Mapping

| Method | Purpose                | Idempotent | Example                        |
|--------|------------------------|------------|--------------------------------|
| GET    | Read / list            | Yes        | `GET /api/v1/products`         |
| POST   | Create                 | No         | `POST /api/v1/invoices`        |
| PUT    | Full update            | Yes        | `PUT /api/v1/products/:id`     |
| PATCH  | Partial update         | Yes        | `PATCH /api/v1/settings/:key`  |
| DELETE | Soft delete            | Yes        | `DELETE /api/v1/customers/:id` |

**DELETE never hard-deletes.** It sets `deleted_at = NOW()`. See database-enforcement skill.

---

## Resource Naming Rules

- Use **plural nouns** for collections: `/products`, `/invoices`, `/customers`
- Use **kebab-case** for multi-word resources: `/invoice-items`, `/payment-allocations`
- Nest only for strong ownership: `/invoices/:invoiceId/items`
- Maximum nesting depth: **2 levels**
- Use query params for filtering, not path segments

---

## Multi-Tenant Enforcement

Every API request MUST resolve `tenant_id` from the authenticated user's JWT token. **Never accept `tenant_id` from the request body or query params.**

```
Middleware order:
1. authenticate(req)        → extracts user from JWT
2. resolveTenant(req)       → sets req.tenantId from user record
3. featureGate(featureKey)  → checks plan_features / tenant_overrides / usage_tracking
4. authorize(role)          → checks user.role against required role
5. controller(req, res)     → handles business logic
```

---

## Feature Gating Middleware

Before quota-sensitive actions (e.g., creating an invoice), the middleware must:

1. Check `tenant_overrides` for the feature key (e.g., `max_invoices_per_month`). If override exists and is not expired → use it.
2. Otherwise, check `plan_features` for the tenant's active `plan_id`.
3. Compare against `usage_tracking.used_count` for the current period (`YYYY-MM`).
4. If `used_count >= limit_value` → return `403` with upgrade prompt.

---

## Standard Request Format

### Create / Update Body

```json
{
  "name": "Amul Milk 1L",
  "category": "Dairy",
  "barcode": "8901030793509",
  "unit": "pcs",
  "gst_rate": 5.00
}
```

- Use `snake_case` for all field names (matches DB column naming)
- Never include `id`, `tenant_id`, `created_at`, `updated_at`, or `deleted_at` in create/update bodies
- `id` is generated server-side (UUID)
- `tenant_id` is injected from auth middleware

### Query Parameters

| Param       | Type     | Purpose                                  |
|-------------|----------|------------------------------------------|
| `page`      | integer  | Page number (1-indexed, default 1)       |
| `limit`     | integer  | Items per page (default 20, max 100)     |
| `sort`      | string   | Sort field (e.g., `created_at`)          |
| `order`     | string   | `asc` or `desc` (default `desc`)         |
| `search`    | string   | Fuzzy search across name fields          |
| `status`    | string   | Filter by status enum                    |
| `from_date` | ISO date | Start of date range                      |
| `to_date`   | ISO date | End of date range                        |

---

## Standard Response Format

### Success — Single Resource

```json
{
  "success": true,
  "data": { ... }
}
```

### Success — Collection (Paginated)

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 148,
    "totalPages": 8
  }
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Product 'Amul Milk 1L' has only 3 units in stock",
    "field": "quantity"
  }
}
```

---

## HTTP Status Codes

| Code | When to Use                                      |
|------|--------------------------------------------------|
| 200  | Successful read, update, or delete               |
| 201  | Successful create                                |
| 400  | Validation error, malformed request              |
| 401  | Missing or invalid auth token                    |
| 403  | Insufficient role or plan quota exceeded         |
| 404  | Resource not found (or belongs to other tenant)  |
| 409  | Conflict (e.g., duplicate barcode, sync conflict)|
| 422  | Business rule violation (credit limit exceeded)  |
| 500  | Internal server error (never expose internals)   |

---

## Core Endpoint Reference

### Tenants & Auth
| Method | Endpoint                  | Purpose                      |
|--------|---------------------------|------------------------------|
| POST   | `/api/v1/auth/register`   | Register new tenant + admin  |
| POST   | `/api/v1/auth/login`      | Login, return JWT            |
| GET    | `/api/v1/tenants/me`      | Current tenant profile       |
| PATCH  | `/api/v1/tenants/me`      | Update tenant profile        |

### Users
| Method | Endpoint                  | Purpose                      |
|--------|---------------------------|------------------------------|
| GET    | `/api/v1/users`           | List staff (admin only)      |
| POST   | `/api/v1/users`           | Create staff user            |
| PATCH  | `/api/v1/users/:id`       | Update user                  |
| DELETE | `/api/v1/users/:id`       | Soft-delete user             |

### Products & Inventory
| Method | Endpoint                          | Purpose                          |
|--------|-----------------------------------|----------------------------------|
| GET    | `/api/v1/products`                | List products (paginated)        |
| GET    | `/api/v1/products/barcode/:code`  | Lookup by barcode (scanner)      |
| POST   | `/api/v1/products`                | Create product + inventory row   |
| PUT    | `/api/v1/products/:id`            | Update product details           |
| DELETE | `/api/v1/products/:id`            | Soft-delete product              |
| GET    | `/api/v1/inventory`               | List stock levels                |
| PATCH  | `/api/v1/inventory/:productId`    | Manual stock adjustment          |

### Invoices (Billing)
| Method | Endpoint                          | Purpose                          |
|--------|-----------------------------------|----------------------------------|
| GET    | `/api/v1/invoices`                | List invoices (paginated)        |
| GET    | `/api/v1/invoices/:id`            | Get invoice with items           |
| POST   | `/api/v1/invoices`                | Create invoice (full workflow)   |
| DELETE | `/api/v1/invoices/:id`            | Cancel invoice (soft-delete)     |

### Payments
| Method | Endpoint                          | Purpose                          |
|--------|-----------------------------------|----------------------------------|
| GET    | `/api/v1/payments`                | List payments                    |
| POST   | `/api/v1/payments`                | Record payment + allocate        |

### Customers & Ledger
| Method | Endpoint                              | Purpose                      |
|--------|---------------------------------------|------------------------------|
| GET    | `/api/v1/customers`                   | List customers               |
| POST   | `/api/v1/customers`                   | Create customer              |
| GET    | `/api/v1/customers/:id/ledger`        | Get ledger entries           |
| GET    | `/api/v1/customers/:id/balance`       | Get current balance          |

### Purchases & Suppliers
| Method | Endpoint                          | Purpose                          |
|--------|-----------------------------------|----------------------------------|
| GET    | `/api/v1/suppliers`               | List suppliers                   |
| POST   | `/api/v1/suppliers`               | Create supplier                  |
| POST   | `/api/v1/purchases`               | Record purchase + update stock   |

### Expenses
| Method | Endpoint                  | Purpose                      |
|--------|---------------------------|------------------------------|
| GET    | `/api/v1/expenses`        | List expenses                |
| POST   | `/api/v1/expenses`        | Record expense               |

### Offers
| Method | Endpoint                  | Purpose                      |
|--------|---------------------------|------------------------------|
| GET    | `/api/v1/offers`          | List offers                  |
| POST   | `/api/v1/offers`          | Create offer                 |
| PATCH  | `/api/v1/offers/:id`      | Update / deactivate offer    |

### Analytics
| Method | Endpoint                          | Purpose                          |
|--------|-----------------------------------|----------------------------------|
| GET    | `/api/v1/analytics/daily`         | Daily metrics summary            |
| GET    | `/api/v1/analytics/dashboard`     | Dashboard aggregated data        |

### Sync
| Method | Endpoint                  | Purpose                          |
|--------|---------------------------|----------------------------------|
| POST   | `/api/v1/sync/push`       | Push local changes to cloud      |
| GET    | `/api/v1/sync/pull`       | Pull cloud changes to local      |

---

## Validation Rules

- All monetary fields: `decimal(10,2)` — validate to 2 decimal places max
- All quantity fields: `decimal(10,3)` — validate to 3 decimal places max
- GST rates: only `0`, `5`, `12`, `18`, `28` percent
- Payment modes: `cash`, `upi`, `card`, `bank_transfer`, `cheque`
- Invoice status: `paid`, `partial`, `unpaid`, `cancelled`
- User roles: `admin`, `cashier`
- Barcode: optional, but if provided must be unique within tenant

---

## Sync-Aware Responses

For endpoints consumed by the offline client, include sync metadata:

```json
{
  "success": true,
  "data": { ... },
  "_sync": {
    "version": 42,
    "updated_at": "2025-06-15T10:30:00Z"
  }
}
```

---

## Performance Requirements

Per SRS non-functional requirements:

- Invoice generation response: **< 1 second**
- Product search latency: **< 200ms**
- Barcode scan lookup: **near-instant (< 50ms)**
- Paginated lists: must use indexed queries (see database-enforcement skill)
