import json
from fastapi import APIRouter, Query
from models.schemas import DemandPredictionResponse

router = APIRouter()


def calculate_trend(sales_history: list[dict]) -> tuple[float, str, float]:
    """
    Analyze sales history and predict demand.
    Returns: (predicted_demand, trend, confidence)
    """
    if not sales_history or len(sales_history) < 2:
        return (0, "unknown", 0.1)

    # Extract quantities
    quantities = [float(entry.get("quantity", 0)) for entry in sales_history]

    # Simple moving average prediction
    avg = sum(quantities) / len(quantities)

    # Trend: compare first half vs second half
    mid = len(quantities) // 2
    if mid == 0:
        return (avg, "stable", 0.3)

    first_half_avg = sum(quantities[:mid]) / mid if mid > 0 else 0
    second_half_avg = sum(quantities[mid:]) / (len(quantities) - mid) if (len(quantities) - mid) > 0 else 0

    # Determine trend
    if second_half_avg > first_half_avg * 1.15:
        trend = "increasing"
    elif second_half_avg < first_half_avg * 0.85:
        trend = "declining"
    else:
        trend = "stable"

    # Predicted demand: weighted moving average (recent data weighted more)
    weights = list(range(1, len(quantities) + 1))
    weighted_sum = sum(q * w for q, w in zip(quantities, weights))
    weight_total = sum(weights)
    predicted = weighted_sum / weight_total if weight_total > 0 else avg

    # Confidence based on data points
    confidence = min(0.4 + len(quantities) * 0.02, 0.95)

    return (round(predicted, 2), trend, round(confidence, 3))


@router.get("/predict-demand/{product_id}", response_model=DemandPredictionResponse)
async def predict_demand(
    product_id: str,
    sales_history: str = Query(default="[]", description="JSON array of {date, quantity}")
):
    """Predict future demand for a product based on sales history."""
    try:
        history = json.loads(sales_history)
    except (json.JSONDecodeError, TypeError):
        history = []

    predicted_demand, trend, confidence = calculate_trend(history)

    return DemandPredictionResponse(
        predicted_demand=predicted_demand,
        trend=trend,
        confidence_score=confidence,
    )
