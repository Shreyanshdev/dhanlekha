import re
from fastapi import APIRouter
from models.schemas import (
    ParseProductRequest, ParseProductResponse,
    EnrichProductRequest,
)

router = APIRouter()

# ─── Common product categories for Indian retail ───
CATEGORY_KEYWORDS = {
    "Dairy & Eggs": ["milk", "curd", "paneer", "cheese", "butter", "ghee", "egg", "dahi", "lassi", "cream"],
    "Snacks & Biscuits": ["biscuit", "chips", "namkeen", "bhujia", "kurkure", "mixture", "snack", "cookie"],
    "Beverages": ["juice", "cola", "pepsi", "sprite", "water", "tea", "coffee", "drink", "soda", "lassi"],
    "Grains & Flour": ["rice", "wheat", "flour", "atta", "maida", "suji", "rava", "dal", "grain", "besan"],
    "Oils & Ghee": ["oil", "ghee", "mustard", "sunflower", "coconut", "olive", "refined"],
    "Personal Care": ["soap", "shampoo", "toothpaste", "cream", "lotion", "deo", "deodorant", "face wash"],
    "Cleaning": ["detergent", "surf", "vim", "harpic", "lizol", "cleaner", "wash", "phenyl"],
    "Spices & Masala": ["masala", "spice", "turmeric", "haldi", "mirch", "jeera", "cumin", "coriander", "garam"],
    "Noodles & Pasta": ["noodles", "maggi", "pasta", "macaroni", "yippee", "ramen"],
    "Sweets & Confectionery": ["chocolate", "candy", "sweet", "toffee", "mithai", "ladoo", "barfi"],
}

# ─── Unit normalization ───
UNIT_MAP = {
    "gm": "g", "gms": "g", "gram": "g", "grams": "g",
    "kg": "kg", "kgs": "kg", "kilo": "kg", "kilos": "kg", "kilogram": "kg",
    "ml": "ml", "mls": "ml", "millilitre": "ml",
    "l": "litre", "ltr": "litre", "lt": "litre", "litre": "litre", "liter": "litre",
    "pc": "pc", "pcs": "pc", "piece": "pc", "pieces": "pc", "pack": "pack", "packet": "pack",
}


def normalize_name(text: str) -> str:
    """Clean, lowercase, normalize units in product name."""
    name = text.lower().strip()
    name = re.sub(r'\s+', ' ', name)  # Collapse whitespace

    # Normalize units: "500gm" → "500 g", "1L" → "1 litre"
    def replace_unit(match):
        num = match.group(1)
        unit = match.group(2).lower()
        normalized = UNIT_MAP.get(unit, unit)
        return f"{num} {normalized}"

    name = re.sub(r'(\d+)\s*(gm|gms|gram|grams|kg|kgs|kilo|kilos|kilogram|ml|mls|millilitre|l|ltr|lt|litre|liter|pc|pcs|piece|pieces|pack|packet)\b',
                  replace_unit, name, flags=re.IGNORECASE)
    return name


def predict_category(name: str) -> str | None:
    """Simple keyword-based category prediction."""
    words = set(name.lower().split())
    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in words or any(kw in word for word in words):
                return category
    return None


def generate_tags(name: str) -> list[str]:
    """Generate search tags from normalized product name."""
    # Remove common filler words
    stopwords = {"the", "a", "an", "of", "for", "and", "or", "in", "with", "to", "is", "at"}
    words = name.lower().split()
    tags = [w for w in words if w not in stopwords and len(w) > 1]

    # Remove duplicates, preserve order
    seen = set()
    unique_tags = []
    for t in tags:
        if t not in seen:
            seen.add(t)
            unique_tags.append(t)

    return unique_tags


@router.post("/parse-product", response_model=ParseProductResponse)
async def parse_product(request: ParseProductRequest):
    """Parse raw product text into structured data."""
    normalized = normalize_name(request.text)
    category = predict_category(normalized)
    tags = generate_tags(normalized)

    # Confidence based on how many fields we could extract
    confidence = 0.5
    if category:
        confidence += 0.25
    if len(tags) >= 3:
        confidence += 0.15
    if re.search(r'\d+\s*(g|kg|ml|litre|pc|pack)', normalized):
        confidence += 0.1

    return ParseProductResponse(
        normalized_name=normalized,
        predicted_category=category,
        tags=tags,
        price_suggestion=None,  # Would need market data for this
        confidence_score=min(confidence, 1.0),
    )


@router.post("/enrich-product", response_model=ParseProductResponse)
async def enrich_product(request: EnrichProductRequest):
    """Enrich an existing product with AI metadata."""
    normalized = normalize_name(request.name)
    category = predict_category(normalized)

    # If product already has a category, use it to boost confidence
    if request.category and not category:
        category = request.category

    tags = generate_tags(normalized)

    confidence = 0.6
    if category:
        confidence += 0.2
    if len(tags) >= 3:
        confidence += 0.1
    if request.barcode:
        confidence += 0.1

    return ParseProductResponse(
        normalized_name=normalized,
        predicted_category=category,
        tags=tags,
        price_suggestion=None,
        confidence_score=min(confidence, 1.0),
    )
