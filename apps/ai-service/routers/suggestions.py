from fastapi import APIRouter
from models.schemas import SuggestRequest, SuggestResponse, SuggestionItem

router = APIRouter()


def fuzzy_match(query: str, text: str) -> float:
    """Simple fuzzy matching score between query and text."""
    query = query.lower().strip()
    text = text.lower().strip()

    # Exact substring match
    if query in text:
        return 0.95

    # Prefix match
    if text.startswith(query):
        return 0.90

    # Word overlap score
    query_words = set(query.split())
    text_words = set(text.split())
    if not query_words:
        return 0.0

    overlap = len(query_words & text_words)
    score = overlap / len(query_words)

    # Character-level similarity (Jaccard on character trigrams)
    def trigrams(s):
        return set(s[i:i+3] for i in range(len(s) - 2)) if len(s) >= 3 else {s}

    q_tri = trigrams(query)
    t_tri = trigrams(text)
    if q_tri and t_tri:
        jaccard = len(q_tri & t_tri) / len(q_tri | t_tri)
        score = max(score, jaccard)

    return round(score, 3)


@router.post("/suggest-products", response_model=SuggestResponse)
async def suggest_products(request: SuggestRequest):
    """Suggest products from catalog based on fuzzy matching."""
    results = []

    for product in request.catalog:
        name = product.get("name", "")
        score = fuzzy_match(request.query, name)

        # Also check category
        category = product.get("category", "")
        if category:
            cat_score = fuzzy_match(request.query, category)
            score = max(score, cat_score * 0.7)  # Category match is weighted lower

        if score >= 0.2:
            results.append(SuggestionItem(
                product_id=product.get("id", ""),
                name=name,
                score=score,
            ))

    # Sort by score descending, take top 10
    results.sort(key=lambda x: x.score, reverse=True)
    return SuggestResponse(suggestions=results[:10])
