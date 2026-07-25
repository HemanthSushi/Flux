import math
import re
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from io import BytesIO

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone

from .models import Category, CategoryFeedback, CategoryModelState, Transaction

INCOME_CATEGORY = "Salary"
DEFAULT_EXPENSE_CATEGORY = "Others"
ALGORITHM_VERSION = "nb-v1"

_WORD_RE = re.compile(r"[a-z0-9]+")
_AMOUNT_RE = re.compile(
    r"(?:(?:USD|INR|EUR|GBP)\s*)?(?:₹\s*)?([0-9]{1,3}(?:[, ][0-9]{3})*(?:\.[0-9]{2})|[0-9]+\.[0-9]{2})",
    re.IGNORECASE,
)
_DATE_RE = re.compile(r"\b\d{1,4}[/-]\d{1,2}[/-]\d{1,4}\b|\b\d{1,2}\.\d{1,2}\.\d{2,4}\b")

_CATEGORY_KEYWORDS = {
    "food": ["restaurant", "cafe", "grocery", "swiggy", "zomato", "ubereats", "dinner", "lunch", "breakfast"],
    "travel": ["uber", "ola", "taxi", "bus", "train", "flight", "fuel", "petrol", "diesel", "parking", "toll"],
    "bills": ["electricity", "water", "internet", "wifi", "phone", "mobile", "utility", "bill", "recharge"],
    "shopping": ["amazon", "flipkart", "mall", "store", "purchase", "order", "shopping"],
    "health": ["pharmacy", "hospital", "clinic", "medicine", "doctor", "lab", "diagnostic"],
    "education": ["course", "tuition", "school", "college", "udemy", "book", "exam", "training"],
}


def _tokenize(text: str) -> list[str]:
    return _WORD_RE.findall((text or "").lower())


def get_accessible_categories(user, txn_type: str = Transaction.EXPENSE):
    categories = Category.objects.filter(is_default=True) | Category.objects.filter(owner=user)
    if txn_type == Transaction.INCOME:
        return categories.filter(name__iexact=INCOME_CATEGORY).order_by("name")
    return categories.exclude(name__iexact=INCOME_CATEGORY).order_by("name")


def is_category_accessible(user, category: Category | None) -> bool:
    if category is None:
        return False
    if category.is_default:
        return True
    return bool(user.is_staff or category.owner_id == user.id)


def _build_training_samples(user) -> list[tuple[str, int]]:
    samples: list[tuple[str, int]] = []
    txn_samples = (
        Transaction.objects.filter(
            owner=user,
            txn_type=Transaction.EXPENSE,
            category__isnull=False,
        )
        .exclude(category__name__iexact=INCOME_CATEGORY)
        .values_list("notes", "category_id")
    )
    for notes, category_id in txn_samples:
        text = (notes or "").strip()
        if text:
            samples.append((text, category_id))

    feedback_samples = CategoryFeedback.objects.filter(owner=user, corrected_category__isnull=False).values_list(
        "description", "corrected_category_id"
    )
    for text, category_id in feedback_samples:
        cleaned = (text or "").strip()
        if cleaned:
            samples.append((cleaned, category_id))

    return samples


def retrain_user_model(user, force: bool = False) -> tuple[CategoryModelState, bool]:
    stale_hours = int(getattr(settings, "AI_MODEL_RETRAIN_HOURS", 24))
    state, _ = CategoryModelState.objects.get_or_create(owner=user)
    stale_before = timezone.now() - timedelta(hours=stale_hours)
    had_existing_model = bool(state.trained_at or state.model_data)

    if (
        not force
        and state.trained_at
        and state.trained_at >= stale_before
        and state.model_data
    ):
        return state, False

    samples = _build_training_samples(user)
    class_counts: Counter[int] = Counter()
    token_totals: Counter[int] = Counter()
    token_counts: defaultdict[int, Counter[str]] = defaultdict(Counter)
    vocabulary: set[str] = set()

    for text, category_id in samples:
        tokens = _tokenize(text)
        if not tokens:
            continue
        class_counts[category_id] += 1
        token_counts[category_id].update(tokens)
        token_totals[category_id] += len(tokens)
        vocabulary.update(tokens)

    model_data: dict = {}
    if class_counts and vocabulary:
        model_data = {
            "algorithm": ALGORITHM_VERSION,
            "alpha": 1.0,
            "vocab_size": len(vocabulary),
            "class_counts": {str(k): int(v) for k, v in class_counts.items()},
            "token_totals": {str(k): int(v) for k, v in token_totals.items()},
            "token_counts": {
                str(category_id): dict(counter)
                for category_id, counter in token_counts.items()
            },
        }

    state.model_data = model_data
    state.sample_count = len(samples)
    state.feedback_count_since_train = 0
    state.trained_at = timezone.now()
    state.version = state.version + 1 if had_existing_model else 1
    state.save(
        update_fields=[
            "model_data",
            "sample_count",
            "feedback_count_since_train",
            "trained_at",
            "version",
            "updated_at",
        ]
    )
    return state, True


def _predict_with_model(model_data: dict, text: str, candidate_ids: list[int]) -> dict[int, float]:
    if not model_data or not candidate_ids:
        return {}
    tokens = _tokenize(text)
    if not tokens:
        return {}

    class_counts = model_data.get("class_counts", {})
    token_totals = model_data.get("token_totals", {})
    token_counts = model_data.get("token_counts", {})
    alpha = float(model_data.get("alpha", 1.0))
    vocab_size = max(int(model_data.get("vocab_size", 0)), 1)

    token_freq = Counter(tokens)
    candidate_keys = [str(cid) for cid in candidate_ids]
    total_docs = sum(float(class_counts.get(key, 0)) for key in candidate_keys)
    if total_docs <= 0:
        return {}

    scores: dict[int, float] = {}
    for category_id in candidate_ids:
        key = str(category_id)
        class_doc_count = float(class_counts.get(key, 0))
        prior = (class_doc_count + 1.0) / (total_docs + len(candidate_ids))
        score = math.log(prior)

        class_token_total = float(token_totals.get(key, 0))
        denominator = class_token_total + alpha * vocab_size
        class_token_counts = token_counts.get(key, {})

        for token, count in token_freq.items():
            token_count = float(class_token_counts.get(token, 0))
            token_prob = (token_count + alpha) / denominator
            score += count * math.log(token_prob)

        scores[category_id] = score

    max_score = max(scores.values())
    exp_scores = {cid: math.exp(score - max_score) for cid, score in scores.items()}
    total = sum(exp_scores.values()) or 1.0
    return {cid: value / total for cid, value in exp_scores.items()}


def _keywords_for_category(name: str) -> list[str]:
    lowered = name.lower()
    keywords: list[str] = []
    for canonical, words in _CATEGORY_KEYWORDS.items():
        if canonical in lowered:
            keywords.extend(words)
    keywords.extend([token for token in re.split(r"[^a-z0-9]+", lowered) if token])
    return keywords


def _predict_with_keywords(text: str, categories: list[Category]) -> dict[int, float]:
    lowered = (text or "").lower()
    if not lowered:
        return {}

    scores: dict[int, float] = {}
    for category in categories:
        score = 0.0
        for keyword in _keywords_for_category(category.name):
            if len(keyword) < 3:
                continue
            if keyword in lowered:
                score += 1.0
        if score > 0:
            scores[category.id] = score

    if not scores:
        return {}

    max_score = max(scores.values())
    exp_scores = {cid: math.exp(score - max_score) for cid, score in scores.items()}
    total = sum(exp_scores.values()) or 1.0
    return {cid: value / total for cid, value in exp_scores.items()}


def _combine_probabilities(model_probs: dict[int, float], keyword_probs: dict[int, float]) -> dict[int, float]:
    if not model_probs and not keyword_probs:
        return {}
    if not model_probs:
        return keyword_probs
    if not keyword_probs:
        return model_probs

    combined: dict[int, float] = {}
    all_keys = set(model_probs.keys()) | set(keyword_probs.keys())
    for key in all_keys:
        combined[key] = 0.75 * model_probs.get(key, 0.0) + 0.25 * keyword_probs.get(key, 0.0)

    total = sum(combined.values()) or 1.0
    return {cid: score / total for cid, score in combined.items()}


def suggest_category(user, description: str, txn_type: str = Transaction.EXPENSE) -> dict:
    categories = list(get_accessible_categories(user, txn_type))
    if not categories:
        return {
            "category": None,
            "confidence": 0.0,
            "model_version": None,
            "retrained": False,
            "sample_count": 0,
            "needs_feedback": True,
        }

    if txn_type == Transaction.INCOME:
        category = categories[0]
        return {
            "category": category,
            "confidence": 1.0,
            "model_version": None,
            "retrained": False,
            "sample_count": 0,
            "needs_feedback": False,
        }

    model_state, retrained = retrain_user_model(user, force=False)
    candidate_ids = [category.id for category in categories]
    model_probs = _predict_with_model(model_state.model_data, description, candidate_ids)
    keyword_probs = _predict_with_keywords(description, categories)
    probabilities = _combine_probabilities(model_probs, keyword_probs)

    if probabilities:
        best_id = max(probabilities, key=probabilities.get)
        confidence = float(probabilities[best_id])
        category = next((cat for cat in categories if cat.id == best_id), None)
    else:
        category = next(
            (cat for cat in categories if cat.name.lower() == DEFAULT_EXPENSE_CATEGORY.lower()),
            categories[0],
        )
        confidence = 0.35 if (description or "").strip() else 0.0

    threshold = float(getattr(settings, "AI_CATEGORY_FEEDBACK_THRESHOLD", 0.65))
    return {
        "category": category,
        "confidence": round(confidence, 4),
        "model_version": model_state.version if model_state else None,
        "retrained": retrained,
        "sample_count": model_state.sample_count if model_state else 0,
        "needs_feedback": confidence < threshold,
    }


def update_feedback_counter_and_maybe_retrain(user) -> tuple[CategoryModelState, bool]:
    threshold = int(getattr(settings, "AI_RETRAIN_FEEDBACK_THRESHOLD", 10))
    stale_hours = int(getattr(settings, "AI_MODEL_RETRAIN_HOURS", 24))

    state, _ = CategoryModelState.objects.get_or_create(owner=user)
    state.feedback_count_since_train += 1
    state.save(update_fields=["feedback_count_since_train", "updated_at"])

    stale_before = timezone.now() - timedelta(hours=stale_hours)
    stale = not state.trained_at or state.trained_at < stale_before
    if state.feedback_count_since_train >= threshold or stale:
        state, _ = retrain_user_model(user, force=True)
        return state, True
    return state, False


def retrain_all_user_models(force: bool = False, user_id: int | None = None) -> tuple[int, int]:
    user_model = get_user_model()
    if user_id is not None:
        users = list(user_model.objects.filter(id=user_id))
    else:
        transaction_user_ids = Transaction.objects.values_list("owner_id", flat=True).distinct()
        feedback_user_ids = CategoryFeedback.objects.values_list("owner_id", flat=True).distinct()
        state_user_ids = CategoryModelState.objects.values_list("owner_id", flat=True).distinct()
        combined_ids = set(transaction_user_ids) | set(feedback_user_ids) | set(state_user_ids)
        users = list(user_model.objects.filter(id__in=combined_ids))

    processed = 0
    retrained = 0
    for user in users:
        processed += 1
        _, did_retrain = retrain_user_model(user, force=force)
        if did_retrain:
            retrained += 1
    return processed, retrained


def _parse_decimal(value: str) -> Decimal | None:
    cleaned = value.replace(",", "").replace(" ", "")
    try:
        amount = Decimal(cleaned)
    except InvalidOperation:
        return None
    if amount <= 0:
        return None
    return amount.quantize(Decimal("0.01"))


def _parse_date(value: str) -> date | None:
    normalized = value.replace(".", "/").replace("-", "/")
    formats = ("%Y/%m/%d", "%d/%m/%Y", "%m/%d/%Y", "%y/%m/%d", "%d/%m/%y", "%m/%d/%y")
    for fmt in formats:
        try:
            parsed = datetime.strptime(normalized, fmt).date()
            if 2000 <= parsed.year <= 2100:
                return parsed
        except ValueError:
            continue
    return None


def extract_text_from_upload(uploaded_file) -> tuple[str, str]:
    file_name = getattr(uploaded_file, "name", "receipt")
    extension = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
    content = uploaded_file.read()
    if not content:
        return "", "empty"

    if extension in {"txt", "csv"}:
        return content.decode("utf-8", errors="ignore"), "text"

    if extension == "pdf":
        try:
            from pypdf import PdfReader
        except ImportError as exc:
            raise RuntimeError("PDF support requires pypdf. Install backend dependencies.") from exc

        reader = PdfReader(BytesIO(content))
        pages = [page.extract_text() or "" for page in reader.pages[:10]]
        extracted_text = "\n".join(pages).strip()
        if extracted_text:
            return extracted_text, "pdf-text"

        # Scanned PDFs are often image-only, so plain text extraction returns empty.
        # Fallback: OCR embedded page images when available.
        try:
            from PIL import Image
            import pytesseract
        except ImportError as exc:
            raise RuntimeError(
                "Scanned PDF OCR requires Pillow and pytesseract. Install backend dependencies."
            ) from exc

        tesseract_cmd = getattr(settings, "TESSERACT_CMD", "").strip()
        if tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

        ocr_chunks = []
        for page in reader.pages[:10]:
            page_images = getattr(page, "images", []) or []
            for image_file in page_images[:5]:
                image_bytes = getattr(image_file, "data", b"")
                if not image_bytes:
                    continue
                try:
                    image = Image.open(BytesIO(image_bytes)).convert("RGB")
                    text = pytesseract.image_to_string(image).strip()
                    if text:
                        ocr_chunks.append(text)
                except Exception:
                    continue

        if ocr_chunks:
            return "\n".join(ocr_chunks).strip(), "pdf-image-ocr"
        return "", "pdf-empty"

    if extension in {"png", "jpg", "jpeg", "bmp", "tif", "tiff", "webp"}:
        try:
            from PIL import Image
            import pytesseract
        except ImportError as exc:
            raise RuntimeError(
                "Image OCR requires Pillow and pytesseract. Install backend dependencies."
            ) from exc

        tesseract_cmd = getattr(settings, "TESSERACT_CMD", "").strip()
        if tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

        image = Image.open(BytesIO(content))
        text = pytesseract.image_to_string(image)
        return text.strip(), "image-ocr"

    return content.decode("utf-8", errors="ignore").strip(), "fallback-text"


def parse_receipt_text(raw_text: str) -> dict:
    lines = [line.strip() for line in (raw_text or "").splitlines() if line.strip()]
    merchant = ""
    for line in lines[:5]:
        if re.search(r"[A-Za-z]", line):
            merchant = line[:160]
            break

    amount_candidates = [_parse_decimal(match.group(1)) for match in _AMOUNT_RE.finditer(raw_text or "")]
    amount_values = [value for value in amount_candidates if value is not None]
    amount = max(amount_values) if amount_values else None

    detected_date = None
    for match in _DATE_RE.finditer(raw_text or ""):
        detected_date = _parse_date(match.group(0))
        if detected_date:
            break

    description_parts = []
    if merchant:
        description_parts.append(merchant)
    if len(lines) > 1:
        description_parts.extend(lines[1:3])
    description = " | ".join(description_parts)[:240]

    return {
        "merchant": merchant,
        "amount": amount,
        "date": detected_date,
        "description": description,
    }
