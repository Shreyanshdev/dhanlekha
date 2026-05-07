from pydantic import BaseModel
from typing import Optional


# ─── Product Parsing ───

class ParseProductRequest(BaseModel):
    text: str

class ParseProductResponse(BaseModel):
    normalized_name: str
    predicted_category: Optional[str] = None
    tags: list[str]
    price_suggestion: Optional[float] = None
    confidence_score: float


# ─── Voice Billing ───

class VoiceParseRequest(BaseModel):
    transcript: str
    product_catalog: list[dict]

class VoiceItem(BaseModel):
    product_name: str
    quantity: float
    confidence: float

class VoiceParseResponse(BaseModel):
    items: list[VoiceItem]


# ─── Smart Suggestions ───

class SuggestRequest(BaseModel):
    query: str
    catalog: list[dict]

class SuggestionItem(BaseModel):
    product_id: str
    name: str
    score: float

class SuggestResponse(BaseModel):
    suggestions: list[SuggestionItem]


# ─── Demand Prediction ───

class DemandPredictionResponse(BaseModel):
    predicted_demand: Optional[float] = None
    trend: str  # "increasing" | "stable" | "declining"
    confidence_score: float


# ─── Product Enrichment ───

class EnrichProductRequest(BaseModel):
    name: str
    category: Optional[str] = None
    barcode: Optional[str] = None


# ─── Health ───

class HealthResponse(BaseModel):
    status: str
    version: str
