# 🤖 DhanLekha AI Service

**Python FastAPI microservice** powering AI features for the DhanLekha ERP system — product parsing, voice billing, smart suggestions, and demand prediction.

---

## Architecture

```
Node.js Backend (Express)
        │
        │  HTTP (Axios, 5s timeout)
        ▼
Python AI Service (FastAPI)
   ├── Product Parser     → NLP-based product name normalization
   ├── Voice Parser       → Hindi/English transcript → invoice items
   ├── Smart Suggestions  → Fuzzy matching + trigram similarity
   ├── Demand Forecaster  → Weighted moving average + trend analysis
   └── Product Enricher   → Background AI metadata generation
```

### Core Principle
> **The ERP works 100% without this service.** All AI calls from the backend are wrapped in try/catch with fallback logic. If this service is down, the ERP uses local string parsing as a fallback.

---

## Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | FastAPI | ≥0.104 |
| Validation | Pydantic v2 | ≥2.0 |
| Server | Uvicorn | ≥0.24 |
| Language | Python | ≥3.10 |

---

## Project Structure

```
apps/ai-service/
├── main.py                  # FastAPI app entry point
├── requirements.txt         # Python dependencies
├── Dockerfile               # Container config (production)
├── routers/
│   ├── __init__.py
│   ├── health.py            # GET  /ai/health
│   ├── product.py           # POST /ai/parse-product
│   │                        # POST /ai/enrich-product
│   ├── voice.py             # POST /ai/parse-voice
│   ├── suggestions.py       # POST /ai/suggest-products
│   └── demand.py            # GET  /ai/predict-demand/:pid
└── models/
    ├── __init__.py
    └── schemas.py           # Pydantic request/response models
```

---

## API Endpoints

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/ai/health` | Returns service status and version |

**Response:**
```json
{ "status": "ok", "version": "1.0.0" }
```

---

### Product Parsing
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/ai/parse-product` | Parse raw product text into structured data |

**Request:**
```json
{ "text": "Parle G biscuit 200gm" }
```

**Response:**
```json
{
  "normalized_name": "parle g biscuit 200 g",
  "predicted_category": "Snacks & Biscuits",
  "tags": ["parle", "biscuit", "200", "g"],
  "price_suggestion": null,
  "confidence_score": 0.9
}
```

**How it works:**
1. **Normalization** — Lowercases, collapses whitespace, normalizes units (`gm` → `g`, `L` → `litre`)
2. **Category Prediction** — Keyword matching against 10 Indian retail categories (Dairy, Snacks, Beverages, Grains, Oils, Personal Care, Cleaning, Spices, Noodles, Sweets)
3. **Tag Generation** — Splits into searchable keywords, removes stopwords
4. **Confidence Scoring** — Based on how many fields could be extracted (category found +0.25, tags ≥3 +0.15, unit detected +0.1)

---

### Product Enrichment
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/ai/enrich-product` | Enrich existing product with AI metadata |

**Request:**
```json
{
  "name": "Amul Gold Milk 1L",
  "category": "Dairy",
  "barcode": "8901234567890"
}
```

**Response:** Same as parse-product. Uses existing category as a fallback and barcode presence to boost confidence.

---

### Voice Billing
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/ai/parse-voice` | Convert speech transcript to invoice items |

**Request:**
```json
{
  "transcript": "do kilo cheeni aur ek packet atta",
  "product_catalog": [
    { "name": "Sugar 1kg", "barcode": "123" },
    { "name": "Wheat Flour 5kg", "barcode": "456" }
  ]
}
```

**Response:**
```json
{
  "items": [
    { "product_name": "Sugar 1kg", "quantity": 2, "confidence": 0.8 },
    { "product_name": "Wheat Flour 5kg", "quantity": 1, "confidence": 0.7 }
  ]
}
```

**How it works:**
1. **Hindi Alias Resolution** — Maps Hindi words to English (`cheeni` → `sugar`, `atta` → `wheat flour`, `doodh` → `milk`)
2. **Number Extraction** — Handles both Hindi (`do` → 2, `teen` → 3) and English number words
3. **Segment Splitting** — Splits transcript on "aur" / "and" / commas
4. **Catalog Matching** — Fuzzy word-overlap matching against the provided product catalog

---

### Smart Suggestions
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/ai/suggest-products` | Get ranked product suggestions |

**Request:**
```json
{
  "query": "amul",
  "catalog": [
    { "id": "uuid-1", "name": "Amul Gold Milk 1L", "category": "Dairy" },
    { "id": "uuid-2", "name": "Amul Butter 500g", "category": "Dairy" }
  ]
}
```

**Response:**
```json
{
  "suggestions": [
    { "product_id": "uuid-1", "name": "Amul Gold Milk 1L", "score": 0.95 },
    { "product_id": "uuid-2", "name": "Amul Butter 500g", "score": 0.95 }
  ]
}
```

**How it works:**
1. **Substring matching** — Direct substring check (score: 0.95)
2. **Prefix matching** — If text starts with query (score: 0.90)
3. **Word overlap** — Set intersection of query and product name words
4. **Trigram similarity** — Character-level Jaccard similarity for fuzzy/typo matching
5. Returns **top 10** results sorted by score

---

### Demand Prediction
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/ai/predict-demand/:product_id` | Predict future demand |

**Query Params:**
- `sales_history` — JSON array of `[{date, quantity}]`

**Response:**
```json
{
  "predicted_demand": 15.5,
  "trend": "increasing",
  "confidence_score": 0.72
}
```

**How it works:**
1. **Weighted Moving Average** — Recent data points weighted higher than older ones
2. **Trend Detection** — Compares first-half avg vs second-half avg of the sales window
   - `> 15%` increase → `"increasing"`
   - `> 15%` decrease → `"declining"`
   - Otherwise → `"stable"`
3. **Confidence** — Scales with data points: `0.4 + (n * 0.02)`, capped at `0.95`

---

## Plan Gating (Backend Enforcement)

AI features are gated by subscription plan. The Node.js backend checks `plan_features` before forwarding requests:

| Feature Flag Key | Starter | Growth | Enterprise |
|-----------------|---------|--------|------------|
| `ai_product_entry` | ❌ | ✅ | ✅ |
| `ai_smart_suggestions` | ❌ | ✅ | ✅ |
| `ai_voice_billing` | ❌ | ❌ | ✅ |
| `ai_demand_prediction` | ❌ | ❌ | ✅ |

---

## Running Locally

### Standalone
```bash
cd apps/ai-service
pip3 install -r requirements.txt
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Via Monorepo (with backend)
```bash
npm run dev          # Starts backend + AI service together
npm run dev:ai       # Starts AI service only
```

### Docker
```bash
docker compose up ai-service
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8000` | AI service port |
| `PYTHONUNBUFFERED` | `1` | Flush stdout immediately (for Docker logs) |

The backend connects to this service via:
| Variable | Default | Description |
|----------|---------|-------------|
| `AI_SERVICE_URL` | `http://localhost:8000` | Set in backend `.env` |
| `AI_TIMEOUT` | `5000` | Max milliseconds to wait for AI response |

---

## Resilience

The backend includes a **circuit breaker** that protects against cascading failures:

1. After **3 consecutive AI failures**, the circuit opens
2. While open (60s cooldown), all AI calls return **local fallbacks** instantly
3. After cooldown, the next call is a "probe" — if it succeeds, the circuit closes

This ensures that even if the AI service crashes, the ERP continues operating normally.

---

## Testing

```bash
# Run the full integration test suite (requires both backend + AI running)
node api-testing/sprint14_test.js
```

The test covers:
- ✅ Product parsing with category + tag extraction
- ✅ Voice billing with Hindi transcript
- ✅ Smart suggestions with fuzzy matching
- ✅ Demand prediction with empty history
- ✅ Product enrichment + cache verification
- ✅ Plan gating (Starter blocked, Enterprise allowed)
