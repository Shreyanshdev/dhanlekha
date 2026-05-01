---
name: code-review
description: Reviews code for correctness, performance, financial accuracy, and adherence to the Antigravity ERP architecture. Use when reviewing any code changes.
---

# Code Review Skill

Structured code review process for the Antigravity ERP system. Every review must verify correctness, financial safety, data integrity, and architectural compliance.

---

## When to Use

- Reviewing any pull request or code change
- Validating billing, payment, or ledger logic
- Checking database queries and migrations
- Verifying API endpoint implementations
- Auditing sync or offline-related code

---

## Review Checklist (Ordered by Priority)

### 1. Financial Correctness (Critical)

- [ ] All monetary calculations use `decimal`, never `float`
- [ ] GST calculated **after** discounts, not before
- [ ] `invoice_items.unit_price` and `gst_rate` are snapshots (frozen at sale time)
- [ ] `final_amount = subtotal - discount_amount + tax_amount`
- [ ] `amount_due = final_amount - amount_paid`
- [ ] Ledger `running_balance = previous + debit - credit`
- [ ] `customers.total_due` updated in same transaction as ledger insert
- [ ] Credit limit checked before allowing credit sales
- [ ] Payment allocations correctly reduce `amount_due` on invoices
- [ ] `payments.unallocated_amount` correctly tracks advance credit

### 2. Data Integrity

- [ ] All multi-table mutations wrapped in a database transaction
- [ ] `tenant_id` filtered in every query — no cross-tenant leakage
- [ ] `deleted_at IS NULL` in all default query scopes
- [ ] Soft deletes used (never `DELETE FROM` on protected tables)
- [ ] UUIDs used as primary keys (no auto-increment)
- [ ] `invoice_sequences` locked with `SELECT FOR UPDATE` during number generation
- [ ] `inventory.total_quantity` never goes negative
- [ ] `inventory_logs` appended on every stock change (immutable audit trail)
- [ ] Correct `change_type` used in inventory_logs (`sale`, `purchase`, `adjustment`, `return`, `waste`)

### 3. Multi-Tenant Security

- [ ] `tenant_id` derived from JWT/auth, never from request body
- [ ] Every repository method filters by `tenant_id`
- [ ] No endpoint allows accessing data from another tenant
- [ ] User role checked: admin vs cashier permissions enforced
- [ ] Plan/quota enforcement in place for gated features
- [ ] Feature gate order: `tenant_overrides → plan_features → usage_tracking`

### 4. Architecture Compliance

- [ ] Controller → Service → Repository layers respected
- [ ] No business logic in controllers
- [ ] No `req`/`res` access in services
- [ ] No raw SQL in controllers
- [ ] Validation performed before service call (Joi/Zod)
- [ ] Standard error classes used (`AppError`, `ValidationError`, etc.)
- [ ] Standard response format (`{ success, data }` or `{ success, error }`)
- [ ] Proper HTTP status codes (201 for create, 404 not 200 for missing, etc.)

### 5. Billing Engine Validation

- [ ] Invoice creation follows the 10-step atomic workflow (see billing-logic skill)
- [ ] `usage_tracking.used_count` incremented after invoice creation
- [ ] `offers.used_count` incremented when offer applied
- [ ] `max_uses` checked before applying an offer
- [ ] Active offer query uses correct date range and `is_active` filter
- [ ] Inventory decremented in same transaction as invoice insert
- [ ] Barcode lookup query is indexed and fast

### 6. Payment System Validation

- [ ] Payment → allocation → invoice update → ledger all in one transaction
- [ ] Allocation amounts sum to ≤ payment amount
- [ ] Invoice `status` correctly transitions: unpaid → partial → paid
- [ ] `payments.status`: received → partially_allocated → fully_allocated
- [ ] Advance credit (unallocated_amount) handled correctly

### 7. Performance

- [ ] Queries use indexed columns (see db.md indexing strategy)
- [ ] Pagination implemented for list endpoints (not unbounded SELECTs)
- [ ] No N+1 query patterns
- [ ] Heavy aggregations read from `daily_metrics`, not raw tables
- [ ] Redis caching used for settings and feature flags
- [ ] Barcode lookup: < 50ms target
- [ ] Product search: < 200ms target
- [ ] Invoice generation: < 1s target

### 8. Sync Safety (Offline-First)

- [ ] Changes logged to `sync_queue` for offline operations
- [ ] `version` field incremented for conflict detection
- [ ] `device_id` included in sync records
- [ ] Conflict strategy respected (`server_wins`, `client_wins`, `manual`)
- [ ] Sync operations don't break running balances or inventory counts

### 9. Edge Cases

- [ ] Zero-quantity line items rejected
- [ ] Zero-amount payments rejected
- [ ] Duplicate barcode within tenant handled
- [ ] Customer with no prior ledger entries handled (first entry sets balance)
- [ ] Invoice with 0 discount handled correctly
- [ ] Products with 0% GST handled correctly
- [ ] Cancelling an already-cancelled invoice handled
- [ ] Payment for a fully-paid invoice rejected
- [ ] Batch tracking: expired batches skipped in FEFO consumption

### 10. Code Quality

- [ ] Functions are small and single-purpose
- [ ] Error messages are specific and actionable
- [ ] No sensitive data logged (passwords, tokens, personal info)
- [ ] Internal errors not exposed to client (500s return generic message)
- [ ] Comments explain "why", not "what"
- [ ] Naming follows conventions: `snake_case` for DB fields, `camelCase` for JS

---

## Review Severity Levels

| Level    | Meaning                                           | Action         |
|----------|---------------------------------------------------|----------------|
| BLOCKER  | Financial error, data corruption, security hole   | Must fix       |
| CRITICAL | Missing transaction, cross-tenant leak, no index  | Must fix       |
| MAJOR    | Business rule violation, missing validation       | Should fix     |
| MINOR    | Code style, naming, missing comment               | Nice to fix    |
| INFO     | Suggestion, alternative approach                  | Optional       |

---

## Feedback Format

```
[SEVERITY] file:line — Description

Why: Explanation of the impact
Fix: Suggested correction
```

Example:
```
[BLOCKER] invoice.service.js:45 — GST calculated before discount

Why: Indian GST law requires tax on the post-discount amount. 
     This will produce incorrect tax amounts on every discounted invoice.
Fix: Move GST calculation after discount subtraction:
     taxable = (unit_price * quantity) - discount_amount
     gst = taxable * (gst_rate / 100)
```

---

## Quick Reference — Enum Values to Validate

| Field                          | Valid Values                                           |
|-------------------------------|-------------------------------------------------------|
| `users.role`                  | admin, cashier                                        |
| `invoices.status`             | paid, partial, unpaid, cancelled                      |
| `payments.status`             | received, partially_allocated, fully_allocated         |
| `payments.payment_mode`       | cash, upi, card, bank_transfer, cheque                |
| `inventory_logs.change_type`  | sale, purchase, adjustment, return, waste              |
| `customer_ledger.entry_type`  | invoice, payment, adjustment                          |
| `offers.offer_type`           | flat, percentage, bogo, bundle                        |
| `offers.applies_to`           | product, category, invoice, customer                  |
| `sync_queue.action`           | insert, update, delete                                |
| `sync_queue.conflict_strategy`| server_wins, client_wins, manual                      |
| `tenants.plan_status`         | trial, active, expired, cancelled                     |
| `plan_features.feature_type`  | quota, toggle                                         |