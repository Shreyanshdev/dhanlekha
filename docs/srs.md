# Software Requirements Specification (SRS)

## Project Title
AI-Powered Offline ERP Billing System

---

# 1. Introduction

## 1.1 Purpose

This document defines the functional and non-functional requirements for a multi-tenant, offline-first ERP system designed for small to medium businesses such as retailers, vendors, and shopkeepers.

The system aims to provide a complete solution for billing, inventory management, accounting, analytics, and AI-driven automation while ensuring high performance and reliability in offline environments.

---

## 1.2 Scope

The system will provide:

- Billing and invoicing system with GST support
- Inventory management with stock tracking
- Customer and supplier management
- Credit (ledger-based) accounting system
- Payment tracking and reconciliation
- Offline-first functionality with sync capabilities
- SaaS-based multi-tenant architecture
- Feature-based subscription plans
- AI-powered automation (product entry, predictions)
- Analytics and reporting dashboard

### Premium ERP Scope (Phase 4.5 — Sprints 17–29)

To reach parity with premium ERP/accounting suites (Marg, Tally, Vyapar, Zoho Books) and CRM platforms (Salesforce, Zoho CRM), the system additionally provides:

- Double-entry accounting (chart of accounts, journals, financial statements)
- Accounts payable and supplier payments
- Full GST compliance (CGST/SGST/IGST, GSTR-1/3B, e-invoice/IRN, e-way bill)
- Credit/debit notes and sales/purchase returns
- Bank and cash management with reconciliation
- Order management (quotation, sales order, purchase order, GRN, delivery challan)
- Advanced inventory (FEFO batches, FIFO/weighted-average valuation, multi-UoM, price lists, serial tracking)
- CRM (leads, opportunities, pipeline, activities, loyalty, segmentation)
- Multi-channel communication (email, SMS, WhatsApp, campaigns)
- Granular role-based access control and complete authentication
- Platform services (public API, webhooks, subscription billing, document generation, file storage)

---

## 1.3 Definitions

| Term | Description |
|------|------------|
| Tenant | A business entity using the system |
| Invoice | Billing document for a sale |
| Ledger | Record of financial transactions (debit/credit) |
| Inventory | Product stock |
| Sync | Data synchronization between local and cloud |
| Feature Flag | Controlled feature availability per plan |

---

# 2. System Overview

## 2.1 System Architecture
Frontend (React + Electron)
↓
Backend (Node.js)
↓
Local Database (SQLite)
↓
Sync Engine
↓
Cloud Database (PostgreSQL)

AI Service (Python FastAPI)
Cache Layer (Redis)
Message Queue (Kafka - future)


---

## 2.2 Technology Stack

### Frontend
- React.js
- Electron (Desktop Application)

### Backend
- Node.js (Express / Fastify)

### AI Layer
- Python (FastAPI)

### Databases
- SQLite (offline/local)
- PostgreSQL (cloud)

### Infrastructure
- Docker (containerization)
- Redis (caching, queue)
- Kafka (event streaming - future)

### Monorepo
- Turborepo / Nx

---

# 3. Functional Requirements

---

## 3.1 Multi-Tenant & SaaS Management

- Create and manage tenants
- Assign subscription plans
- Enforce feature access using:
  - plan_features
  - tenant_overrides
  - usage_tracking
- Track subscription lifecycle

---

## 3.2 User Management

- User authentication (JWT/session-based)
- Role-based access control:
  - Admin
  - Cashier
- Manage user activity and permissions

---

## 3.3 Product Management

- Create, update, delete products
- Categorize products
- Assign barcode to products
- AI-assisted product creation
- Search and filter products

---

## 3.4 Inventory Management

- Track stock levels
- Maintain inventory logs
- Handle stock inflow (purchases)
- Handle stock outflow (sales)
- Support batch-based inventory (future)
- Trigger low stock alerts

---

## 3.5 Billing System

- Create invoices
- Add multiple products per invoice
- Apply:
  - Product-level discounts
  - Invoice-level discounts
- GST calculation (post-discount)
- Generate final payable amount
- Update inventory on sale
- Generate printable invoices

---

## 3.6 Barcode-Based Billing

- Support USB barcode scanners
- Fetch product by barcode
- Add scanned product directly to invoice
- Ensure real-time performance

---

## 3.7 Payment System

- Record payments
- Support:
  - Full payments
  - Partial payments
  - Advance payments
- Allocate payments to invoices
- Maintain payment history

---

## 3.8 Ledger System

- Maintain customer ledger
- Record:
  - Debit entries (invoices)
  - Credit entries (payments)
- Maintain running balance
- Ensure financial consistency

---

## 3.9 Supplier & Purchase Management

- Manage suppliers
- Record purchase transactions
- Update inventory on purchase
- Maintain purchase history

---

## 3.10 Expense Management

- Record business expenses
- Categorize expenses
- Include expenses in profit calculations

---

## 3.11 Discount & Offer Engine

- Support discount types:
  - Percentage
  - Flat
  - Buy-One-Get-One (BOGO)
  - Bundle offers
- Apply offers based on:
  - Product
  - Category
  - Cart value

---

## 3.12 Offline Sync System

- Store all changes locally
- Maintain sync_queue
- Sync data to cloud when online
- Handle conflicts:
  - Last-write-wins
  - Version-based resolution

---

## 3.13 Alerts & Notifications

- Low stock alerts
- Payment due alerts
- System error alerts
- Sync failure alerts

---

## 3.14 Analytics & Reporting

- Daily and monthly sales reports
- Profit and loss calculation
- Inventory insights
- Customer behavior analytics
- Dashboard visualization

---

## 3.15 AI Features

- AI-based product parsing
- Voice-based billing (future)
- Smart product suggestions
- Demand forecasting
- Price suggestions

---

# 3A. Premium ERP Functional Requirements (Phase 4.5)

> These requirements extend the core system delivered in Sprints 0–16. They are implemented backend-first in Sprints 17–29.

---

## 3.16 Double-Entry Accounting & General Ledger

- Maintain a per-tenant chart of accounts (asset, liability, income, expense, equity)
- Seed a default chart of accounts on tenant registration
- Record every financial event as a balanced journal entry (total debit = total credit)
- Auto-post journals from invoices, payments, purchases, expenses, and returns
- Support manual journal entries (admin only) with mandatory narration
- Provide per-account ledger with running balance
- The customer ledger and supplier ledger act as subledgers reconciling to control accounts

## 3.17 Financial Reporting

- Trial Balance for any date range
- Profit & Loss statement
- Balance Sheet
- Cash Flow statement
- Day Book (chronological journal listing)
- Financial-year management with opening balances and year-end close

## 3.18 Accounts Payable & Supplier Payments

- Maintain a supplier ledger (debit/credit/running balance)
- Record supplier payments and allocate them to purchases
- Track outstanding payable per supplier
- Purchases post payable entries to the general ledger

## 3.19 GST Compliance & e-Invoicing

- Split tax into CGST, SGST, and IGST based on place of supply
- Determine intra-state vs inter-state supply automatically
- Maintain HSN/SAC codes and produce HSN summaries
- Generate GSTR-1 (outward supplies) and GSTR-3B (summary) reports
- Generate e-invoices (IRN + signed QR) via a pluggable GSP/IRP adapter
- Generate e-way bills with transporter and vehicle details
- Adapter must be optional and sandbox-capable so core billing works offline

## 3.20 Credit / Debit Notes & Returns

- Issue credit notes against invoices (sales returns / adjustments)
- Issue debit notes against purchases (purchase returns)
- Reverse inventory, tax, ledger, and GL postings correctly
- Include notes in GST returns

## 3.21 Bank & Cash Management

- Manage multiple bank accounts and cash registers per branch
- Link payments and expenses to a specific bank/cash account
- Record deposits, withdrawals, and transfers
- Bank reconciliation against statement lines
- Cash book and day-close

## 3.22 Order Management

- Quotations that convert to sales orders or invoices
- Sales orders with fulfilment tracking
- Purchase orders with goods-receipt notes (GRN)
- Delivery challans
- Document status lifecycle and source/target linkage for audit

## 3.23 Advanced Inventory

- Batch tracking with FEFO consumption wired into billing
- Stock valuation methods: FIFO and weighted-average
- Multiple units of measure with conversion factors
- Price lists and customer/tier-specific pricing
- Serial number / IMEI tracking
- Reorder levels with automatic purchase-order suggestions
- Stock transfers between branches

## 3.24 Customer Relationship Management (CRM)

- Lead capture with source and status
- Opportunities with value, stage, and expected close date
- Configurable sales pipeline stages
- Activities: tasks, calls, meetings, notes, follow-ups
- Lead → opportunity → customer conversion
- Customer segmentation
- Loyalty program (points earned and redeemed)

## 3.25 Communication & Engagement

- Transactional and bulk messaging over email, SMS, and WhatsApp
- Message templates (payment reminders, invoices, offers)
- Marketing campaigns to customer segments
- Communication logs for auditability
- Pluggable provider interface for each channel

## 3.26 Access Control & Authentication

- Granular role-based access control with custom roles and a permission matrix
- Permission checks per action (e.g. `invoice:create`)
- Complete auth lifecycle: login, logout, token refresh
- Password reset and change-password flows
- Optional two-factor authentication (TOTP)

## 3.27 Platform Services & Integrations

- Public API with issued API keys
- Webhooks with delivery retry
- OpenAPI/Swagger documentation for all endpoints
- SaaS subscription billing via payment gateway (Razorpay/Stripe)
- Server-side document generation (PDF invoices/reports, Excel export)
- File and document storage (product images, attachments)
- Sync apply worker that writes queued offline changes to domain tables
- Audit logging of all mutations
- Observability (metrics, tracing) and an automated test suite

---

# 3B. Offline Resilience, Drafts & Hardware (Phase 4.6 + Frontend)

> These requirements harden real retail-floor and offline operation. Backend items are delivered in Phase 4.6 (Sprints 30–32); client items in Phase 5.

---

## 3.28 Draft "Chit" Invoices & Soft Reserve

- Create draft invoices ("chits") without consuming a formal GST invoice number
- Drafts carry a daily `token_number` (e.g. T-405) for physical floor chits
- Soft-reserve stock for draft items (decrement quantity, log as `reserved`) to prevent offline double-selling
- Draft does not post to the customer ledger
- Finalize converts a draft into a formal sequenced invoice, turns reserved stock into a sale, and posts the ledger
- Cancelling a draft releases the reserved stock

## 3.29 Bulk Data Import (Onboarding)

- Import products and customers from CSV (`multipart/form-data`)
- Entire import runs in a single transaction; any invalid row rolls back the whole batch
- Return a per-row validation error report

## 3.30 Additive Inventory Sync

- Inventory quantity must not use last-write-wins / server-wins conflict resolution
- The sync worker replays each device's stock-movement deltas so concurrent offline sales subtract additively across branches

## 3.31 Offline Security & Licensing

- Enforce a signed offline license (JWT) verified with a public key before any offline write
- Monotonic clock guard: reject operations if the system clock moves backward (anti-time-travel lockdown)
- Enforce license expiry (require sync) and an offline invoice-volume quota
- Lockdown/clear error codes: `SECURITY_LOCKDOWN`, `LICENSE_EXPIRED`, `QUOTA_EXCEEDED`

## 3.32 Offline Authentication

- Cashiers can authenticate offline using a hashed 4-digit Offline PIN stored locally
- On network failure at boot, validate the offline license and present the Offline PIN screen instead of the online login
- Expose an offline-mode flag to disable cloud-only UI

## 3.33 Local Data Persistence

- Desktop client persists large local datasets in SQLite via an Electron IPC bridge (not browser localStorage)
- Client state/persistence reads and writes through a secure context-bridge database API

## 3.34 Hardware Printing

- Support thermal and dot-matrix (DMP) printers via raw ESC/POS commands, bypassing the OS print spooler
- Support a cash-drawer kick command
- Provide a browser/OS print fallback when raw printing is unavailable

---

# 4. Non-Functional Requirements

---

## 4.1 Performance

- Invoice generation < 1 second
- Product search latency < 200 ms
- Barcode scan response near-instant

---

## 4.2 Reliability

- Full functionality without internet
- No data loss during offline operations
- Automatic retry for failed sync

---

## 4.3 Scalability

- Support multiple tenants
- Handle increasing transaction volume
- Horizontal scalability (future microservices)

---

## 4.4 Security

- Tenant data isolation
- Secure authentication
- Role-based access control
- Data encryption (at rest and in transit)

---

## 4.5 Data Integrity

- ACID-compliant transactions
- Ledger must always balance
- Inventory must remain consistent
- No direct deletion (soft deletes only)

---

## 4.6 Maintainability

- Modular architecture
- Monorepo structure
- Clean separation of concerns
- Proper logging and monitoring

---

## 4.7 Usability

- Simple UI for non-technical users
- Keyboard-first navigation
- Minimal steps for billing
- Fast response time

---

# 5. Data Requirements

---

## 5.1 Core Entities

- Tenants
- Plans & Features
- Users
- Products
- Inventory
- Customers
- Suppliers
- Invoices
- Payments
- Ledger
- Purchases
- Expenses
- Alerts
- Sync Queue

---

## 5.2 Key Design Principles

- All tables linked via `tenant_id`
- Separation of:
  - Product vs Inventory
  - Invoice vs Payment
- Maintain logs for audit
- Support versioning for sync

---

# 6. System Workflows

---

## 6.1 Billing Workflow
Select Product →
Apply Discount →
Calculate GST →
Create Invoice →
Update Inventory →
Update Ledger


---

## 6.2 Payment Workflow
Record Payment →
Allocate to Invoice →
Update Ledger →
Reduce Due


---

## 6.3 Purchase Workflow
Create Purchase →
Add Items →
Increase Inventory →
Log Transaction


---

## 6.4 Sync Workflow
Local Change →
Add to Sync Queue →
Sync to Cloud →
Resolve Conflicts


---

# 7. Constraints

- Must operate on low-end hardware
- Must work without continuous internet
- Must comply with GST rules (configurable)
- Must maintain data consistency during sync

---

# 8. Assumptions

- Users have basic computer literacy
- Barcode scanners act as keyboard input
- Internet is intermittent, not continuous

---

# 9. Future Enhancements

- Mobile application
- Multi-device synchronization
- GST filing integration
- Advanced BI dashboards
- AI assistant for business insights

---

# 10. Conclusion

This system is designed to be a modern ERP solution combining:

- Offline-first reliability
- SaaS scalability
- AI-driven automation
- Financial accuracy

It aims to replace traditional billing systems with a faster, smarter, and more adaptable platform.

---