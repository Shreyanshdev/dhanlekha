
# billingSoftware — Technology Stack

## Overview

This document defines the finalized technology stack for the billingSoftware ERP system.  
The system is designed to be offline-first, scalable, and modular, with support for AI-driven features and SaaS architecture.

---

# 1. Architecture Summary

DhanLekha follows a hybrid architecture:

- Offline-first desktop application
- Local database with sync to cloud
- Modular backend services
- AI as a separate service layer

---

# 2. Frontend Layer

## Technologies
- Next.js (React framework)
- Electron (desktop wrapper)

## Responsibilities
- User interface (billing, dashboard, reports)
- Local interactions (keyboard, barcode scanner)
- Offline-first experience
- Communication with backend APIs

## Notes
- Next.js is used for UI and routing
- Electron packages the app as a desktop application

---

# 3. Desktop Runtime

## Electron

Electron allows running a web application (Next.js) as a desktop app.

### Responsibilities
- Access to local system (filesystem, printers)
- Offline execution
- Hardware integration (barcode scanner)
- Packaging app for Windows/macOS/Linux

---

# 4. Backend Layer

## Technologies
- Node.js
- Express.js (or Fastify)

## Responsibilities
- Business logic (billing, inventory, ledger)
- API layer
- Validation and processing
- Sync engine (offline → cloud)

## Structure
- Modular monolith (initially)
- Future-ready for microservices

---

# 5. AI Layer

## Technologies
- Python
- FastAPI

## Responsibilities
- Product parsing (AI-based entry)
- Smart suggestions
- Demand prediction
- Future: voice processing

## Design Principle
- AI is optional and non-blocking
- Core system must work without AI

---

# 6. Database Layer

## Local Database (Primary)
- SQLite

### Purpose
- Offline storage
- Fast read/write
- Per-device database

---

## Cloud Database (Secondary)
- PostgreSQL

### Purpose
- Backup and sync
- Multi-device support
- Analytics

---

# 7. Caching & Queue Layer

## Redis

### Usage
- Caching frequently used data
- Background job processing
- Session management

---

## Queue System
- BullMQ (Node.js + Redis)

### Usage
- Sync jobs
- Analytics processing
- Alert generation

---

# 8. Event Streaming (Future)

## Apache Kafka

### Purpose
- Event-driven architecture
- Analytics pipelines
- Service communication

### Note
- Not required in initial phase
- Introduced during scaling

---

# 9. Monorepo Management

## Tool
- Turborepo (or Nx)

## Structure
/apps
/frontend
/backend
/ai-service

/packages
/db
/shared
/utils


---

# 10. DevOps & Deployment

## Containerization
- Docker
- Docker Compose (local development)

## Future
- Kubernetes (optional at scale)

---

# 11. Hardware Integration

## Barcode Scanner
- USB-based scanner (keyboard input mode)

### Behavior
- Acts like typing input
- Scanned code triggers product lookup

---

# 12. Security

- JWT-based authentication (with refresh-token rotation — Sprint 28)
- Granular role-based access control with custom roles and a permission matrix (Sprint 28)
- Tenant-level data isolation
- Secure password hashing
- Password reset and optional TOTP two-factor authentication (Sprint 28)
- Immutable audit logging of all mutations (Sprint 17)
- API-key auth and signed webhooks for external integrations (Sprint 29)

---

# 13. Key Design Principles

- Offline-first system
- Multi-tenant architecture
- Ledger-based accounting
- Event-driven extensibility
- AI as enhancement, not dependency
- Modular and scalable design

---

# 13A. Premium ERP Technology Additions (Phase 4.5)

These technologies are introduced in Sprints 17–29 to support accounting, GST compliance, order management, CRM, and platform maturity. All external integrations follow an **adapter/provider interface** so the core system keeps working offline with a sandbox/no-op implementation.

## 13A.1 Accounting & Money

- **Money handling:** integer-paise storage with a precise money library (e.g. `dinero.js` / `decimal.js`) to avoid floating-point drift in the general ledger.
- Double-entry posting implemented in the existing Knex `withTransaction` helper — no new datastore required.

## 13A.2 GST Compliance & e-Invoicing

- **GSP/IRP adapter** for e-invoice (IRN + signed QR) and e-way bill generation, called over HTTPS via Axios.
- Pluggable provider config via env; sandbox adapter for offline/dev.
- GSTR-1 / GSTR-3B report builders (JSON/CSV export).

## 13A.3 Communication Providers

- **Email:** SMTP via `nodemailer` (provider-agnostic).
- **SMS:** Indian SMS gateway (e.g. MSG91) or Twilio behind a `NotificationService` interface.
- **WhatsApp:** WhatsApp Cloud API.
- Bulk/campaign sends queued through BullMQ.

## 13A.4 SaaS Subscription Billing

- **Payment gateway:** Razorpay (primary, India) / Stripe behind a billing adapter, for tenant plan payments and webhooks.

## 13A.5 Document Generation & Storage

- **PDF:** server-side invoice/report rendering (e.g. `puppeteer` or `pdfkit`).
- **Excel/CSV export:** `exceljs`.
- **File storage:** S3-compatible object storage (e.g. AWS S3 / MinIO) in cloud mode, local filesystem in offline mode, behind a storage adapter.

## 13A.6 Platform & Integration

- **Public API + webhooks:** API-key auth, webhook delivery with retry via BullMQ.
- **API documentation:** OpenAPI/Swagger (e.g. `swagger-ui-express` + `zod-to-openapi`).
- **Auth hardening:** refresh-token rotation, password reset, and TOTP 2FA (e.g. `otplib`).
- **Observability:** Prometheus-style metrics and OpenTelemetry tracing; structured error tracking.
- **Testing:** Vitest/Jest + Supertest for unit and integration test suites.

---

# 13B. Offline Resilience & Hardware Additions (Phase 4.6 + Frontend)

These technologies support draft chits, bulk onboarding, tamper-resistant offline licensing, large local storage, and direct hardware printing (Sprints 30–32 backend; client work in Phase 5).

## 13B.1 Local Storage & IPC

- **better-sqlite3** running in the Electron main process as the local datastore.
- Renderer access via a `contextBridge` IPC bridge (`window.db.query(sql, params)`) — bypasses the browser `localStorage` ~5MB limit and handles GBs of offline data.
- Zustand persistence layer reads/writes through the IPC bridge instead of `localStorage`.

## 13B.2 Bulk Import

- **csv-parser / fast-csv** for streaming CSV onboarding of products and customers, processed inside a single transactional batch.

## 13B.3 Offline Licensing & Security

- **Signed JWT license** (`jsonwebtoken`) verified with a bundled public key (asymmetric RS256 signing on the server).
- **Monotonic clock watermark** stored in local SQLite to detect system-clock tampering.
- **bcrypt** offline PIN hashing for cashier offline authentication.

## 13B.4 Hardware Printing

- **electron-pos-printer / escpos** for raw ESC/POS output to thermal and dot-matrix printers, bypassing the OS print spooler.
- Cash-drawer kick via the standard ESC/POS byte sequence; raw buffer exposed to the renderer through `preload.ts`.

---

# 14. Final Stack Summary

| Layer | Technology |
|------|-----------|
| Frontend | Next.js + React |
| Desktop | Electron |
| Backend | Node.js (Express/Fastify) |
| AI | Python (FastAPI) |
| Local DB | SQLite |
| Cloud DB | PostgreSQL |
| Cache | Redis |
| Queue | BullMQ |
| Events | Kafka (future) |
| Monorepo | Turborepo |
| Container | Docker |
| Money | integer paise + decimal.js/dinero.js |
| GST / e-Invoice | GSP/IRP adapter (sandbox + provider) |
| Email | nodemailer (SMTP) |
| SMS | MSG91 / Twilio |
| WhatsApp | WhatsApp Cloud API |
| Subscription billing | Razorpay / Stripe |
| PDF / Export | Puppeteer / PDFKit + ExcelJS |
| File storage | S3 / MinIO (cloud) · local FS (offline) |
| API docs | OpenAPI / Swagger |
| 2FA | TOTP (otplib) |
| Observability | Prometheus + OpenTelemetry |
| Testing | Vitest/Jest + Supertest |
| Local store (desktop) | better-sqlite3 via Electron IPC bridge |
| CSV import | csv-parser / fast-csv |
| Offline license | signed JWT (RS256) + monotonic clock |
| Receipt printing | electron-pos-printer / escpos (ESC/POS) |

---

# 15. Conclusion

This stack is optimized for:

- Fast development
- Offline reliability
- Future scalability
- AI integration
- Real-world business usage

billingSoftware is designed to evolve from a modular monolith into a distributed, intelligent ERP platform.

---