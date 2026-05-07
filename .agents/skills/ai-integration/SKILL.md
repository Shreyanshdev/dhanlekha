---
name: ai-integration
description: Defines the AI service architecture, communication contracts, fallback strategies, and feature implementation guidelines for integrating the Python FastAPI AI service with the DhanLekha ERP backend. Use when building, modifying, or debugging any AI-powered feature.
---

# AI Integration Skill

Master reference for all AI-related development in DhanLekha ERP. This skill governs how the Node.js backend communicates with the Python AI microservice, how AI data is stored, and how the system degrades gracefully when AI is unavailable.

---

## When to Use

- Implementing or modifying any AI-powered feature
- Adding new AI endpoints or prediction models
- Configuring the Python FastAPI service
- Handling AI service failures or timeouts
- Working with the `product_ai_data` table
- Implementing voice billing, smart search, or demand forecasting
- Updating feature flags for AI plan gating

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DhanLekha ERP Backend                     │
│                    (Node.js / Express)                       │
│                                                             │
│  ┌──────────────┐    ┌───────────────┐    ┌──────────────┐  │
│  │ AI Module    │───►│ AI Client     │───►│ AI Cache     │  │
│  │ (Controller  │    │ (Axios +      │    │ (product_    │  │
│  │  Service     │    │  Circuit      │    │  ai_data +   │  │
│  │  Validator)  │    │  Breaker)     │    │  Redis)      │  │
│  └──────────────┘    └───────┬───────┘    └──────────────┘  │
└──────────────────────────────┼───────────────────────────────┘
                               │ HTTP (Axios)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    AI Service (Python)                       │
│                    FastAPI + Pydantic                        │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Product      │  │ Demand       │  │ Voice        │      │
│  │ Parser       │  │ Forecaster   │  │ Parser       │      │
│  │ (NLP)        │  │ (ML Model)   │  │ (STT + NLP)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ Smart        │  │ Product      │                        │
│  │ Suggestions  │  │ Enrichment   │                        │
│  │ (Similarity) │  │ (Background) │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### Core Principle: AI is OPTIONAL

> **The ERP MUST function 100% without the AI service.**
> AI features are *enhancements*, never *dependencies*.
> Every AI call must have a fallback path that returns a sensible default.
> AI failures are warnings, NEVER errors to the user.

---

## AI Features — Complete Endpoint Map

The AI service runs at `AI_SERVICE_URL` (env var, default `http://localhost:8000`).
All calls are async and non-blocking — **never block billing on AI responses**.

| Feature | Backend Endpoint | Python Endpoint | When to Call | Plan Gate |
|---------|-----------------|-----------------|-------------|-----------|
| **Product Auto-Entry** | `POST /api/v1/ai/parse-product` | `POST /ai/parse-product` | User types free-text product name | `ai_product_entry` → Growth + Enterprise |
| **Voice Billing** | `POST /api/v1/ai/parse-voice` | `POST /ai/parse-voice` | Speech-to-text transcript received | `ai_voice_billing` → Enterprise only |
| **Smart Suggestions** | `POST /api/v1/ai/suggest-products` | `POST /ai/suggest-products` | Invoice item being added | `ai_smart_suggestions` → Growth + Enterprise |
| **Demand Prediction** | `GET /api/v1/ai/demand/:productId` | `GET /ai/predict-demand/:pid` | Daily metrics job or inventory check | `ai_demand_prediction` → Enterprise only |
| **Product Enrichment** | `POST /api/v1/ai/enrich-product` | `POST /ai/enrich-product` | New product created (runs in background) | `ai_product_entry` → Growth + Enterprise |

---

## Feature Flag Matrix (Plan Gating)

**Plan gate check BEFORE every AI call.** These flags must exist in `feature_flags` and `plan_features`:

| Feature Flag Key | Type | Starter | Growth | Enterprise |
|-----------------|------|---------|--------|------------|
| `ai_product_entry` | toggle | ❌ OFF | ✅ ON | ✅ ON |
| `ai_smart_suggestions` | toggle | ❌ OFF | ✅ ON | ✅ ON |
| `ai_voice_billing` | toggle | ❌ OFF | ❌ OFF | ✅ ON |
| `ai_demand_prediction` | toggle | ❌ OFF | ❌ OFF | ✅ ON |

### Enforcement Pattern

```typescript
// BEFORE calling AI, check the specific plan feature
const featureKey = 'ai_product_entry'; // or ai_voice_billing, etc.
const planFeature = await db('plan_features')
  .join('tenants', 'plan_features.plan_id', 'tenants.plan_id')
  .where({ 'tenants.id': tenantId, 'plan_features.feature_id': featureKey })
  .first();

if (!planFeature?.is_enabled) {
  throw new ForbiddenError(`AI feature '${featureKey}' is not available on your plan. Upgrade required.`);
}
```

---

## Communication Contract

### AI Client Configuration

```typescript
// config/aiClient.ts
import axios from 'axios';
import env from './env';

const aiClient = axios.create({
  baseURL: env.ai.baseUrl,       // AI_SERVICE_URL env var → default http://localhost:8000
  timeout: 5000,                  // 5s hard timeout — never block billing
  headers: { 'Content-Type': 'application/json' }
});

export default aiClient;
```

### Environment Variable

```bash
# .env
AI_SERVICE_URL=http://localhost:8000
```

### Mandatory Rules

| Rule | Rationale |
|------|-----------|
| **5-second timeout** | AI must never block the billing flow |
| **Try/catch every call** | AI failures are warnings, never errors |
| **Cache results** | Store AI output in `product_ai_data` for offline use |
| **Confidence scores** | Track `confidence_score` (0.000–1.000) for quality monitoring |
| **Feature-gated** | Each AI feature has its OWN plan feature flag |
| **Tenant-scoped** | AI data inherits the same `tenant_id` isolation |

---

## Python AI Service Specification

### Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | FastAPI |
| Validation | Pydantic v2 |
| NLP | spaCy / basic regex for MVP |
| Server | Uvicorn |
| Container | Docker |
| Port | 8000 |

### Directory Structure

```
apps/ai-service/
├── main.py                  # FastAPI app entry
├── requirements.txt         # Python dependencies
├── Dockerfile               # Container config
├── config.py                # Environment config
├── routers/
│   ├── product.py           # Product parsing + enrichment endpoints
│   ├── demand.py            # Demand prediction endpoint
│   ├── voice.py             # Voice billing endpoint
│   ├── suggestions.py       # Smart product suggestions
│   └── health.py            # Health check
├── services/
│   ├── parser.py            # Product name parsing logic
│   ├── categorizer.py       # AI category prediction
│   ├── forecaster.py        # Demand forecasting model
│   ├── tag_generator.py     # Search tag generation
│   └── voice_parser.py      # Voice transcript → invoice items
└── models/
    └── schemas.py           # Pydantic request/response models
```

### Python API Endpoints

| Method | Endpoint | Request | Response |
|--------|----------|---------|----------|
| `POST` | `/ai/parse-product` | `{ text: str }` | `{ normalized_name, predicted_category, tags[], price_suggestion, confidence_score }` |
| `POST` | `/ai/parse-voice` | `{ transcript: str, product_catalog: [{name, barcode}] }` | `{ items: [{product_name, quantity, confidence}] }` |
| `POST` | `/ai/suggest-products` | `{ query: str, catalog: [{id, name, category}] }` | `{ suggestions: [{product_id, name, score}] }` |
| `GET`  | `/ai/predict-demand/:pid` | query: `sales_history` JSON | `{ predicted_demand, trend, confidence_score }` |
| `POST` | `/ai/enrich-product` | `{ name, category, barcode }` | `{ normalized_name, predicted_category, tags[], price_suggestion, confidence_score }` |
| `GET`  | `/ai/health` | — | `{ status: 'ok', version }` |

### Pydantic Models

```python
from pydantic import BaseModel
from typing import Optional

class ParseProductRequest(BaseModel):
    text: str  # Raw text: "Amul Gold Milk 1L pack"

class ParseProductResponse(BaseModel):
    normalized_name: str                 # "amul gold milk 1 litre"
    predicted_category: Optional[str]    # "Dairy & Eggs"
    tags: list[str]                      # ["milk", "dairy", "amul", "1l"]
    price_suggestion: Optional[float]    # 68.00
    confidence_score: float              # 0.87

class VoiceParseRequest(BaseModel):
    transcript: str                      # "do kilo cheeni aur ek packet atta"
    product_catalog: list[dict]          # [{name, barcode}]

class VoiceParseResponse(BaseModel):
    items: list[dict]                    # [{product_name, quantity, confidence}]

class SuggestRequest(BaseModel):
    query: str                           # "mil" (partial typing)
    catalog: list[dict]                  # [{id, name, category}]

class SuggestResponse(BaseModel):
    suggestions: list[dict]              # [{product_id, name, score}]

class DemandPredictionResponse(BaseModel):
    predicted_demand: float              # 150 units next week
    trend: str                           # "increasing" | "stable" | "declining"
    confidence_score: float
```

---

## Database: `product_ai_data` Table

| Field | Type | Constraint | Purpose |
|-------|------|-----------|---------|
| `id` | uuid | PK | Unique identifier |
| `product_id` | uuid | FK → products.id, UNIQUE | One AI profile per product |
| `normalized_name` | string | NOT NULL | Cleaned name for fuzzy search |
| `predicted_category` | string | nullable | AI-suggested category |
| `tags` | json | nullable | Search tag array |
| `price_suggestion` | decimal(10,2) | nullable | AI-suggested price |
| `confidence_score` | decimal(4,3) | nullable | Model confidence (0.000–1.000) |
| `last_used_at` | timestamp | nullable | Cache eviction tracking |
| `updated_at` | timestamp | NOT NULL | Last AI refresh time |

### Cache Strategy

1. **First call** → Query AI service → Store in `product_ai_data` → Return
2. **Subsequent calls** → Check `product_ai_data` first
3. **Stale check** → If `updated_at` older than 7 days, refresh from AI in background
4. **Offline** → Always return cached data, never block

---

## Node.js Backend Module Structure

### Follows 4-file pattern

```
modules/ai/
├── ai.validator.ts      # Zod schemas for all AI requests
├── ai.service.ts        # Business logic + AI client calls + fallbacks
├── ai.controller.ts     # Express request/response handlers
└── ai.routes.ts         # Route definitions with plan-gate middleware
```

### Service Pattern — Graceful Degradation

```typescript
// modules/ai/ai.service.ts
import aiClient from '../../config/aiClient';
import { ProductAiDataRepository } from '../../repositories/productAiData.repo';

export async function parseProduct(tenantId: string, text: string) {
  const repo = new ProductAiDataRepository(tenantId);

  try {
    // 1. Call AI service (5s timeout)
    const response = await aiClient.post('/ai/parse-product', { text });
    const aiData = response.data;

    // 2. Cache result in database for offline use
    await repo.upsertByProductText(text, aiData);

    return { ...aiData, source: 'ai' };
  } catch (error) {
    // 3. AI is down — return basic NLP fallback
    console.warn('[AI] Service unavailable, using fallback parser');
    return {
      normalized_name: text.toLowerCase().trim(),
      predicted_category: null,
      tags: text.toLowerCase().split(/\s+/).filter(t => t.length > 1),
      price_suggestion: null,
      confidence_score: 0,
      source: 'fallback'
    };
  }
}
```

### Key: The try/catch is NOT optional

Every AI service call MUST be wrapped in try/catch. The `catch` block MUST return a sensible fallback — **never throw an error to the user because AI is unavailable**.

---

## Circuit Breaker Pattern

If the AI service fails 3 consecutive times, stop calling it for 60 seconds:

```typescript
class AICircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private readonly threshold = 3;
  private readonly cooldown = 60000; // 60 seconds

  isOpen(): boolean {
    if (this.failures >= this.threshold) {
      return (Date.now() - this.lastFailure) < this.cooldown;
    }
    return false;
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
  }

  recordSuccess(): void {
    this.failures = 0;
  }
}
```

---

## Timeout Hierarchy

| Context | Max Timeout | Reason |
|---------|-------------|--------|
| Billing flow (barcode scan / voice) | 2 seconds | Must not delay cashier |
| Background enrichment job | 10 seconds | Batch processing, no user waiting |
| Manual admin request | 5 seconds | User initiated, can wait briefly |

---

## Docker Integration

The AI service runs as a container alongside the backend:

```yaml
# docker-compose.yml — AI Service block
ai-service:
  build:
    context: ./apps/ai-service
  container_name: dhanlekha-ai
  restart: unless-stopped
  ports:
    - "8000:8000"
  environment:
    - PYTHONUNBUFFERED=1
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/ai/health"]
    interval: 30s
    timeout: 10s
    retries: 3
```

---

## Testing Strategy

### Integration Tests (Node.js → Python)
- Test each AI endpoint returns valid data when service is up
- Test graceful fallback when AI service is down (mock timeout)
- Test `product_ai_data` cache read/write cycle
- Test plan gating blocks Starter tenants from AI features
- Test each feature flag independently

### Test Data — Indian Retail Products

```json
{ "text": "Parle G biscuit 100g" }
{ "text": "amul butter 500gm" }
{ "text": "maggi 2 minute noodles" }
{ "text": "Surf Excel liquid 1L" }
{ "text": "Haldiram bhujia 400g packet" }
{ "text": "do kilo cheeni" }
```

---

## Checklist for AI Feature Development

- [ ] AI service call wrapped in try/catch with sensible fallback
- [ ] Correct feature flag checked (`ai_product_entry`, `ai_voice_billing`, etc.)
- [ ] Timeout set appropriately (2s billing, 5s manual, 10s batch)
- [ ] Result cached in `product_ai_data` where applicable
- [ ] `confidence_score` tracked and returned
- [ ] Response includes `source: 'ai' | 'fallback' | 'cache'`
- [ ] Works 100% when AI service is offline
- [ ] Integration test covers both success and failure paths
- [ ] Python endpoint has Pydantic validation
- [ ] Feature flag seeded in `plan_features` for all 3 plans

---

## Referenced Documents

- **Database Schema** → `docs/db.md` — Sections 3.2 (feature_flags), 12.4 (product_ai_data)
- **Sprint Plan** → `docs/sprint.md` — Sprint 14 scope
- **SRS** → `docs/srs.md` — Section 3.15 (AI Features)
- **Seed Data** → `database/seeds/001_seed_saas_plans.ts` — Plan feature flags
