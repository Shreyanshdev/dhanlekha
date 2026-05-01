---
name: database-enforcement
description: Enforces database schema rules, naming conventions, indexing strategy, migration patterns, and query safety for the Antigravity ERP system. Use when writing or reviewing any database-related code.
---

# Database Enforcement Skill

Enforces all database rules, conventions, and patterns for the Antigravity ERP system. Every migration, query, and schema change MUST comply with this skill.

---

## When to Use

- Writing database migrations
- Creating or modifying tables
- Writing queries in repository layer
- Reviewing database-related code
- Adding indexes or constraints
- Working with sync or offline storage

---

## Database Stack

| Environment | Database   | Purpose                      |
|-------------|-----------|------------------------------|
| Local       | SQLite    | Offline-first primary store  |
| Cloud       | PostgreSQL| Backup, sync, analytics      |

Queries must be compatible with both SQLite and PostgreSQL (use a query builder like Knex.js, not raw SQL where possible).

---

## Primary Key Rules

- **Every table uses `uuid` as primary key**
- UUIDs are generated **client-side** before insert (offline-first requirement)
- **Never use auto-increment IDs**
- ID column is always named `id`

---

## Naming Conventions

| Convention                       | Example                              |
|----------------------------------|--------------------------------------|
| Table names: `snake_case` plural | `invoice_items`, `inventory_batches` |
| Column names: `snake_case`       | `tenant_id`, `created_at`            |
| FK columns end in `_id`          | `customer_id`, `product_id`          |
| Boolean columns start with `is_` | `is_active`, `is_read`, `is_synced`  |
| Soft delete column               | `deleted_at` (nullable timestamp)    |
| Enum-style columns               | `status`, `role`, `action`           |
| Index names: `idx_{table}_{cols}` | `idx_products_barcode`               |

---

## Mandatory Columns

### Every table MUST have:
- `id` (uuid, PK)
- `created_at` (timestamp, NOT NULL)

### Tables with editable data also have:
- `updated_at` (timestamp, NOT NULL)

### Multi-tenant tables (all business data) also have:
- `tenant_id` (uuid, FK → tenants.id, NOT NULL)

---

## Soft Delete Rules

The following tables use soft deletes — **never hard delete from these tables**:

`tenants`, `users`, `customers`, `suppliers`, `products`, `invoices`, `payments`, `purchases`, `expenses`, `offers`

### Implementation:
- Add `deleted_at` (timestamp, nullable) column
- Delete operation: `UPDATE SET deleted_at = NOW()`
- **Every query must include `WHERE deleted_at IS NULL`** in default scope
- Restore: `UPDATE SET deleted_at = NULL`

### Immutable tables (no delete, no update):
- `inventory_logs` — append-only stock audit trail
- `customer_ledger` — append-only financial ledger
- `payment_allocations` — immutable after creation
- `ledger_snapshots` — generated, never modified

---

## Tenant Isolation

**Every query on business data MUST filter by `tenant_id`.**

```javascript
// CORRECT
db('products').where({ tenant_id: tenantId }).whereNull('deleted_at')

// WRONG — cross-tenant data leak
db('products').where({ id: productId })
```

Tables exempt from tenant_id (global tables):
- `plans`
- `feature_flags`
- `plan_features`

---

## Data Types

| Purpose                | Type            | Example                   |
|------------------------|-----------------|---------------------------|
| Money (INR)            | `decimal(10,2)` | 999.99, 1234.50           |
| Quantity               | `decimal(10,3)` | 2.500 (kg), 1.000 (pcs)   |
| GST rate               | `decimal(5,2)`  | 5.00, 12.00, 18.00        |
| Identifiers            | `uuid`          | UUIDv4                    |
| Short text             | `string`        | Names, codes, enum values |
| Long text              | `text`          | Addresses, notes          |
| Boolean                | `boolean`       | is_active, is_read        |
| Date only              | `date`          | valid_from, expiry_date   |
| Date + time            | `timestamp`     | created_at, synced_at     |
| Structured data        | `json`          | product_ai_data.tags      |
| Counter                | `integer`       | current_number, used_count|

**Never use `float` for monetary values.**

---

## Foreign Key Reference

| FK Column         | References        | Notes                           |
|-------------------|-------------------|---------------------------------|
| `tenant_id`       | `tenants.id`      | On all business tables          |
| `plan_id`         | `plans.id`        | On tenants, subscriptions       |
| `customer_id`     | `customers.id`    | On invoices, payments, ledger   |
| `supplier_id`     | `suppliers.id`    | On purchases                    |
| `product_id`      | `products.id`     | On inventory, items, logs       |
| `invoice_id`      | `invoices.id`     | On invoice_items, allocations   |
| `payment_id`      | `payments.id`     | On payment_allocations          |
| `purchase_id`     | `purchases.id`    | On purchase_items               |
| `user_id`         | `users.id`        | On inventory_logs               |
| `created_by`      | `users.id`        | On invoices, users              |
| `recorded_by`     | `users.id`        | On expenses                     |
| `batch_id`        | `inventory_batches.id` | On invoice_items (nullable) |
| `offer_id`        | `offers.id`       | On invoice_items (nullable)     |
| `feature_key`     | `feature_flags.feature_key` | On plan_features, overrides, usage |

---

## Indexing Strategy

**Rule: every FK column gets an index. Every WHERE clause column in a hot query gets an index.**

### Critical Indexes (must create in migrations)

| Index Name                        | Columns                                    |
|-----------------------------------|--------------------------------------------|
| `idx_products_barcode`            | `products(barcode)`                        |
| `idx_products_tenant`             | `products(tenant_id)`                      |
| `idx_products_category`           | `products(tenant_id, category)`            |
| `idx_inventory_product`           | `inventory(product_id)` — UNIQUE           |
| `idx_invoices_tenant_date`        | `invoices(tenant_id, created_at)`          |
| `idx_invoices_customer`           | `invoices(customer_id)`                    |
| `idx_invoices_status`             | `invoices(tenant_id, status)`              |
| `idx_invoice_items_invoice`       | `invoice_items(invoice_id)`                |
| `idx_payments_tenant_date`        | `payments(tenant_id, created_at)`          |
| `idx_payments_customer`           | `payments(customer_id)`                    |
| `idx_allocations_payment`         | `payment_allocations(payment_id)`          |
| `idx_allocations_invoice`         | `payment_allocations(invoice_id)`          |
| `idx_ledger_customer_date`        | `customer_ledger(customer_id, created_at)` |
| `idx_inv_logs_product`            | `inventory_logs(product_id, created_at)`   |
| `idx_offers_tenant_active`        | `offers(tenant_id, is_active, valid_from, valid_until)` |
| `idx_sync_queue_tenant_synced`    | `sync_queue(tenant_id, is_synced)`         |
| `idx_daily_metrics_tenant_date`   | `daily_metrics(tenant_id, date)`           |
| `idx_plan_features_plan`          | `plan_features(plan_id, feature_key)`      |
| `idx_usage_tracking`              | `usage_tracking(tenant_id, feature_key, period)` |
| `idx_customers_phone`             | `customers(phone)`                         |

---

## Transaction Requirements

These operations MUST use database transactions (all-or-nothing):

| Operation          | Tables Modified                                              |
|--------------------|--------------------------------------------------------------|
| Invoice creation   | invoice_sequences, invoices, invoice_items, inventory, inventory_batches, inventory_logs, customer_ledger, customers, usage_tracking, offers |
| Payment recording  | payments, payment_allocations, invoices, customer_ledger, customers |
| Purchase recording | purchases, purchase_items, inventory, inventory_batches, inventory_logs |
| Stock adjustment   | inventory, inventory_logs                                     |

```javascript
// Pattern
await db.transaction(async (trx) => {
  await trx('invoices').insert(...);
  await trx('invoice_items').insert(...);
  await trx('inventory').where(...).decrement(...);
  // If any query fails → automatic rollback
});
```

---

## Invoice Sequence Locking

To prevent duplicate invoice numbers with concurrent cashiers:

```javascript
// Inside transaction
const seq = await trx('invoice_sequences')
  .where({ tenant_id: tenantId })
  .forUpdate()  // SELECT FOR UPDATE — locks the row
  .first();

const newNumber = seq.current_number + 1;
const invoiceNumber = `${seq.prefix}-${String(newNumber).padStart(4, '0')}`;

await trx('invoice_sequences')
  .where({ tenant_id: tenantId })
  .update({ current_number: newNumber, updated_at: new Date() });
```

---

## Migration Best Practices

1. One migration file per logical change
2. Always provide `up` and `down` (rollback) methods
3. Never modify existing migrations — create new ones
4. Include index creation in the same migration as table creation
5. Test migrations on both SQLite and PostgreSQL
6. Use the query builder, not raw SQL

---

## Enum Values Reference

| Table.Column                    | Allowed Values                                  |
|---------------------------------|-------------------------------------------------|
| `tenants.plan_status`           | trial, active, expired, cancelled               |
| `users.role`                    | admin, cashier                                  |
| `invoices.status`               | paid, partial, unpaid, cancelled                |
| `payments.status`               | received, partially_allocated, fully_allocated  |
| `payments.payment_mode`         | cash, upi, card, bank_transfer, cheque          |
| `purchases.status`              | received, partial, pending                      |
| `customer_ledger.entry_type`    | invoice, payment, adjustment                    |
| `inventory_logs.change_type`    | sale, purchase, adjustment, return, waste        |
| `offers.offer_type`             | flat, percentage, bogo, bundle                  |
| `offers.applies_to`             | product, category, invoice, customer            |
| `sync_queue.action`             | insert, update, delete                          |
| `sync_queue.conflict_strategy`  | server_wins, client_wins, manual                |
| `alerts.alert_type`             | low_stock, payment_due, high_demand, expiry_soon, sync_failed |
| `subscriptions.billing_cycle`   | monthly, annual                                 |
| `plan_features.feature_type`    | quota, toggle                                   |
| `expenses.category`             | rent, electricity, wages, packaging, transport, other |

---

## Query Safety Checklist

- [ ] Filtered by `tenant_id`
- [ ] Excludes soft-deleted records (`deleted_at IS NULL`)
- [ ] Uses parameterised queries (no string concatenation)
- [ ] Paginated for list endpoints (never unbounded SELECT)
- [ ] Uses indexed columns in WHERE clause
- [ ] Monetary comparisons use exact decimal, not float
- [ ] Transactions used for multi-table writes