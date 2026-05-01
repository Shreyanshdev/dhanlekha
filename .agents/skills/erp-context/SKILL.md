---
name: erp-context
description: Provides full context of the Antigravity ERP system including architecture, entities, workflows, business rules, and SaaS model. Use when building or modifying any feature.
---

# ERP Context Skill

Master reference for the Antigravity ERP system design. Read this before implementing any feature.

---

## When to Use

- Implementing any backend or frontend feature
- Writing business logic (billing, inventory, ledger)
- Making architectural decisions
- Onboarding to the codebase
- When unsure about system rules or entity relationships

---

## System Overview

Antigravity is a **multi-tenant, offline-first ERP billing system** designed for Indian small-to-medium businesses (retailers, vendors, shopkeepers).

### Architecture

```
Frontend (Next.js + Electron Desktop)
        ↓
Backend (Node.js Express/Fastify)
        ↓
Local Database (SQLite)     →     Sync Engine     →     Cloud Database (PostgreSQL)
        
AI Service (Python FastAPI) — optional, non-blocking
Cache (Redis) + Queue (BullMQ)
```

### Key Design Principles

- **Offline-first** — full functionality without internet, SQLite as primary store
- **Multi-tenant** — every table carries `tenant_id`, complete data isolation
- **Ledger-based accounting** — append-only financial records, never mutate
- **AI as enhancement** — core system works without AI service
- **Modular monolith** — clean separation, future microservices path
- **SaaS model** — subscription plans with feature gating and quotas

---

## Entity Map (25 Tables)

### SaaS & Subscriptions
| Table              | Purpose                                        |
|--------------------|------------------------------------------------|
| plans              | Subscription tiers (Starter, Growth, Enterprise)|
| feature_flags      | Registry of all gatable features               |
| plan_features      | Feature limits per plan (quota or toggle)       |
| subscriptions      | Payment history per tenant                     |
| tenant_overrides   | Custom feature limits for specific tenants     |
| usage_tracking     | Real-time quota consumption per tenant/period  |

### Tenants & Users
| Table              | Purpose                                        |
|--------------------|------------------------------------------------|
| tenants            | Root entity — one per shop/business            |
| users              | Staff accounts (admin, cashier)                |
| settings           | Per-tenant key-value config                    |
| invoice_sequences  | Thread-safe invoice number generation          |

### People
| Table              | Purpose                                        |
|--------------------|------------------------------------------------|
| customers          | Buyers with credit tracking (total_due)        |
| suppliers          | Stock suppliers with GST info                  |

### Products & Inventory
| Table              | Purpose                                        |
|--------------------|------------------------------------------------|
| products           | Catalogue (name, barcode, GST rate, unit)      |
| inventory          | Summary stock per product (qty, prices)        |
| inventory_batches  | Optional batch tracking (FEFO for pharma/FMCG) |
| inventory_logs     | Immutable audit trail of all stock movements   |

### Billing & Payments
| Table              | Purpose                                        |
|--------------------|------------------------------------------------|
| invoices           | Sale transactions with totals                  |
| invoice_items      | Line items with snapshotted prices/GST         |
| offers             | Discounts (flat, %, BOGO, bundle)              |
| payments           | Money received from customers                  |
| payment_allocations| Links payments to invoices (M:N)               |
| customer_ledger    | Append-only debit/credit entries               |
| ledger_snapshots   | Daily closing balance per customer              |

### Purchases & Expenses
| Table              | Purpose                                        |
|--------------------|------------------------------------------------|
| purchases          | Stock received from suppliers                  |
| purchase_items     | Line items per purchase                        |
| expenses           | Operating costs (rent, wages, etc.)            |

### System
| Table              | Purpose                                        |
|--------------------|------------------------------------------------|
| alerts             | Notifications (low stock, payment due)         |
| sync_queue         | Offline change log for sync engine             |
| daily_metrics      | Pre-aggregated daily business stats            |
| product_ai_data    | AI-enriched product metadata                   |

---

## Critical Workflows

### 1. Billing (Invoice Creation)
```
Check quota → Lock invoice_sequences → Generate number →
Calculate line items (price × qty - discount + GST) →
INSERT invoice + items → Decrement inventory → Log stock movement →
Append ledger entry (debit) → Update customer.total_due →
Increment usage_tracking
```
**Must be a single atomic transaction.**

### 2. Payment Recording
```
INSERT payment → Allocate to invoices →
Update invoice amount_paid/due/status →
Append ledger entry (credit) → Update customer.total_due
```
**Must be a single atomic transaction.**

### 3. Purchase (Stock-In)
```
INSERT purchase + items → Increment inventory →
Create batch (if tracking enabled) → Log stock movement
```

### 4. Offline Sync
```
Local change → Append to sync_queue →
On connectivity: replay queue to cloud in order →
Conflict resolution (server_wins / client_wins / manual)
```

---

## Core Business Rules

### Financial
- Ledger is the **source of truth** for customer dues
- `customers.total_due` is a **cached** value for display speed
- GST is calculated **after** discounts
- All prices on `invoice_items` are **snapshots** — immutable after creation
- Never trust frontend calculations — recalculate server-side
- All monetary operations use `decimal(10,2)`, quantities use `decimal(10,3)`

### Data Integrity
- All tables have `tenant_id` — multi-tenant isolation
- Protected tables use **soft deletes** (`deleted_at` timestamp)
- All primary keys are **UUIDs** (generated client-side for offline)
- `inventory_logs` and `customer_ledger` are **append-only** — never update or delete
- `invoice_sequences` uses **SELECT FOR UPDATE** for thread-safe numbering

### SaaS / Feature Gating
- Enforcement order: `tenant_overrides` → `plan_features` → `usage_tracking`
- Quota features: check `used_count < limit_value` before allowing action
- Toggle features: check `is_enabled` flag
- `tenant_overrides` expire via `expires_at` — check before applying

### Roles
| Role    | Access                                                  |
|---------|--------------------------------------------------------|
| admin   | Full access: billing, reports, settings, user management|
| cashier | Billing only: create invoices, accept payments, view own sales |

---

## Relationships Summary

- `tenants` → 1:N → users, customers, suppliers, products, invoices, payments, purchases, expenses, offers
- `tenants` → 1:1 → invoice_sequences
- `products` → 1:1 → inventory, product_ai_data
- `products` → 1:N → inventory_batches, inventory_logs
- `customers` → 1:N → invoices, payments, customer_ledger, ledger_snapshots
- `invoices` → 1:N → invoice_items
- `invoices` ↔ N:M ↔ payments (via payment_allocations)
- `suppliers` → 1:N → purchases → 1:N → purchase_items
- `plans` → 1:N → plan_features

---

## Referenced Documents

For detailed specifications, see:
- **SRS** → `./docs/srs.md` — full functional and non-functional requirements
- **Database** → `./docs/db.md` — all 25 table schemas, indexes, and workflow details
- **Tech Stack** → `./docs/techstack.md` — technology choices and rationale
- **Sprint Plan** → `./docs/sprint.md` — phased execution roadmap (Sprint 0–20, backend-first)