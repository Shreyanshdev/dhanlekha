import re
from fastapi import APIRouter
from models.schemas import VoiceParseRequest, VoiceParseResponse, VoiceItem

router = APIRouter()

# Hindi/English number words → digits
NUMBER_WORDS = {
    "ek": 1, "do": 2, "teen": 3, "char": 4, "panch": 5,
    "chhe": 6, "saat": 7, "aath": 8, "nau": 9, "das": 10,
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "half": 0.5, "aadha": 0.5, "quarter": 0.25,
}

# Hindi product name aliases
HINDI_ALIASES = {
    "cheeni": "sugar", "chini": "sugar",
    "atta": "wheat flour", "maida": "refined flour",
    "chawal": "rice", "daal": "dal", "dhal": "dal",
    "doodh": "milk", "dudh": "milk",
    "tel": "oil", "namak": "salt",
    "sabun": "soap", "chai": "tea",
    "pani": "water",
}

# Unit keywords
UNIT_WORDS = {"kilo", "kg", "gram", "gm", "litre", "liter", "packet", "pack", "piece", "pcs", "dozen"}


def parse_transcript(transcript: str, catalog: list[dict]) -> list[VoiceItem]:
    """Parse a voice transcript into invoice items by matching against the catalog."""
    items = []
    # Normalize transcript
    text = transcript.lower().strip()

    # Replace Hindi aliases
    for hindi, eng in HINDI_ALIASES.items():
        text = text.replace(hindi, eng)

    # Split by "aur" (and) or commas to get individual items
    segments = re.split(r'\s+aur\s+|\s+and\s+|,\s*', text)

    for segment in segments:
        segment = segment.strip()
        if not segment:
            continue

        # Extract quantity
        quantity = 1.0
        for word, num in NUMBER_WORDS.items():
            if word in segment.split():
                quantity = num
                segment = segment.replace(word, "").strip()
                break

        # Try to extract numeric quantity
        num_match = re.search(r'(\d+(?:\.\d+)?)', segment)
        if num_match:
            quantity = float(num_match.group(1))
            segment = segment[:num_match.start()] + segment[num_match.end():]

        # Remove unit words from segment for better matching
        clean_words = [w for w in segment.split() if w not in UNIT_WORDS and len(w) > 1]
        clean_query = " ".join(clean_words).strip()

        if not clean_query:
            continue

        # Match against catalog using substring matching
        best_match = None
        best_score = 0.0

        for product in catalog:
            product_name = product.get("name", "").lower()
            # Score based on word overlap
            query_words = set(clean_query.split())
            product_words = set(product_name.split())
            if not query_words:
                continue

            overlap = len(query_words & product_words)
            score = overlap / len(query_words) if query_words else 0

            # Bonus for substring match
            if clean_query in product_name or product_name in clean_query:
                score = max(score, 0.8)

            if score > best_score and score >= 0.3:
                best_score = score
                best_match = product

        if best_match:
            items.append(VoiceItem(
                product_name=best_match["name"],
                quantity=quantity,
                confidence=round(min(best_score, 1.0), 2),
            ))

    return items


@router.post("/parse-voice", response_model=VoiceParseResponse)
async def parse_voice(request: VoiceParseRequest):
    """Parse a voice billing transcript into structured invoice items."""
    items = parse_transcript(request.transcript, request.product_catalog)
    return VoiceParseResponse(items=items)
