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