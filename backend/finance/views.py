import csv
import smtplib
from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal
from io import BytesIO

from django.conf import settings
from django.core.mail import EmailMessage
from django.db import transaction
from django.db.models import Sum
from django.db.models.functions import TruncMonth
from django.http import HttpResponse
from django.utils.timezone import now
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, parser_classes, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from .ai import (
    extract_text_from_upload,
    is_category_accessible,
    parse_receipt_text,
    retrain_all_user_models,
    suggest_category,
    update_feedback_counter_and_maybe_retrain,
)
from .models import (
    Account,
    Category,
    CategoryBudget,
    CategoryFeedback,
    CategoryModelState,
    FinancialGoal,
    GoalContribution,
    MonthlyBudget,
    ReceiptIngestion,
    RecurringTransaction,
    Transaction,
)
from .permissions import IsOwnerOrAdmin
from .serializers import (
    AccountSerializer,
    AICategorizeSerializer,
    AICategoryFeedbackSerializer,
    CategorySerializer,
    FinancialGoalSerializer,
    GoalContributionCreateSerializer,
    GoalContributionSerializer,
    MonthlyBudgetSerializer,
    ReceiptIngestionResultSerializer,
    ReceiptIngestionSerializer,
    RecurringTransactionSerializer,
    TransactionSerializer,
)

INCOME_CATEGORY = "Salary"
DEFAULT_EXPENSE_CATEGORIES = ["Food", "Travel", "Bills", "Shopping", "Health", "Education", "Others"]


def _ensure_single_default_category(name: str) -> Category:
    # SQLite treats NULLs as distinct in UNIQUE constraints; owner=None defaults can duplicate.
    defaults = list(
        Category.objects.filter(owner__isnull=True, name__iexact=name).order_by("id")
    )
    if not defaults:
        return Category.objects.create(name=name, is_default=True, owner=None)

    primary = defaults[0]
    if primary.name != name or not primary.is_default:
        primary.name = name
        primary.is_default = True
        primary.save(update_fields=["name", "is_default"])

    duplicate_ids = [cat.id for cat in defaults[1:]]
    if duplicate_ids:
        Transaction.objects.filter(category_id__in=duplicate_ids).update(category=primary)
        CategoryBudget.objects.filter(category_id__in=duplicate_ids).update(category=primary)
        Category.objects.filter(id__in=duplicate_ids).delete()
    return primary


def seed_default_categories() -> None:
    with transaction.atomic():
        _ensure_single_default_category(INCOME_CATEGORY)
        for name in DEFAULT_EXPENSE_CATEGORIES:
            _ensure_single_default_category(name)


def _advance_date(current: date, frequency: str, interval: int) -> date:
    interval = max(int(interval or 1), 1)
    if frequency == RecurringTransaction.FREQ_DAILY:
        return current + timedelta(days=interval)
    if frequency == RecurringTransaction.FREQ_WEEKLY:
        return current + timedelta(weeks=interval)
    if frequency == RecurringTransaction.FREQ_MONTHLY:
        month_index = (current.month - 1) + interval
        year = current.year + (month_index // 12)
        month = (month_index % 12) + 1
        day = min(current.day, monthrange(year, month)[1])
        return date(year, month, day)
    if frequency == RecurringTransaction.FREQ_YEARLY:
        year = current.year + interval
        day = min(current.day, monthrange(year, current.month)[1])
        return date(year, current.month, day)
    return current + timedelta(days=interval)


def process_due_recurring_transactions(*, user=None, user_id: int | None = None, as_of: date | None = None) -> dict:
    target_date = as_of or date.today()
    recurring_qs = RecurringTransaction.objects.filter(
        is_active=True,
        auto_create=True,
        next_run_date__lte=target_date,
    ).select_related("owner", "category", "account")

    if user_id:
        recurring_qs = recurring_qs.filter(owner_id=user_id)
    elif user and not user.is_staff:
            recurring_qs = recurring_qs.filter(owner=user)

    generated = 0
    skipped = 0
    processed = 0

    for recurring in recurring_qs:
        dirty = False
        if not recurring.category_id:
            recurring.is_active = False
            recurring.last_run_date = recurring.last_run_date or recurring.next_run_date
            recurring.save(update_fields=["is_active", "last_run_date", "updated_at"])
            skipped += 1
            continue

        while recurring.next_run_date and recurring.next_run_date <= target_date:
            if recurring.end_date and recurring.next_run_date > recurring.end_date:
                recurring.is_active = False
                dirty = True
                break

            run_date = recurring.next_run_date
            tx, created = Transaction.objects.get_or_create(
                source_recurring=recurring,
                recurrence_for_date=run_date,
                defaults={
                    "owner": recurring.owner,
                    "txn_type": recurring.txn_type,
                    "amount": recurring.amount,
                    "category": recurring.category,
                    "account": recurring.account,
                    "date": run_date,
                    "notes": recurring.notes,
                },
            )
            if created:
                generated += 1
            else:
                skipped += 1

            recurring.last_run_date = run_date
            recurring.next_run_date = _advance_date(run_date, recurring.frequency, recurring.interval)
            processed += 1
            dirty = True

            if recurring.end_date and recurring.next_run_date > recurring.end_date:
                recurring.is_active = False
                break

        if dirty:
            recurring.save(update_fields=["last_run_date", "next_run_date", "is_active", "updated_at"])

    return {"processed_schedules": processed, "generated_transactions": generated, "skipped": skipped}


def _build_monthly_report(user, year: int, month: int) -> dict:
    qs = Transaction.objects.filter(owner=user, date__year=year, date__month=month)
    total_income = qs.filter(txn_type=Transaction.INCOME).aggregate(total=Sum("amount"))["total"] or Decimal("0")
    total_expense = qs.filter(txn_type=Transaction.EXPENSE).aggregate(total=Sum("amount"))["total"] or Decimal("0")
    category_breakdown = list(
        qs.filter(txn_type=Transaction.EXPENSE)
        .values("category__name")
        .annotate(total=Sum("amount"))
        .order_by("-total")
    )
    return {
        "year": year,
        "month": month,
        "total_income": total_income,
        "total_expense": total_expense,
        "savings": total_income - total_expense,
        "category_breakdown": category_breakdown,
    }


def _money(value: Decimal) -> str:
    return f"{Decimal(value):,.2f}"


def _truncate(value: str, size: int) -> str:
    text = (value or "").replace("\n", " ").strip()
    if len(text) <= size:
        return text
    return f"{text[: max(size - 3, 0)]}..."


def _draw_pdf_logo(pdf, x: float, y: float, text_color=None) -> None:
    # y is top coordinate for the logo block.
    icon_size = 24
    icon_y = y - icon_size
    green = colors.HexColor("#5D826A")
    default_text = colors.HexColor("#5E6066")
    resolved_text_color = text_color or default_text

    pdf.setStrokeColor(green)
    pdf.setLineWidth(2)
    pdf.roundRect(x, icon_y, icon_size, icon_size, 4, stroke=1, fill=0)
    pdf.line(x - 5, y - 4, x, y - 4)
    pdf.line(x - 5, y - 10, x, y - 10)
    pdf.line(x - 5, y - 16, x, y - 16)
    pdf.line(x + 4, y - 18, x + 9, y - 14)
    pdf.line(x + 9, y - 14, x + 14, y - 15)
    pdf.line(x + 14, y - 15, x + 19, y - 9)
    pdf.setFillColor(green)
    pdf.roundRect(x + icon_size + 3, icon_y + 4, 2.5, icon_size - 8, 1, stroke=0, fill=1)

    pdf.setFillColor(resolved_text_color)
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(x + 34, y - 10, "Money")
    pdf.drawString(x + 34, y - 24, "Diary")


def _draw_pdf_header(pdf, user, report: dict, page_number: int, continued: bool = False) -> float:
    page_width, page_height = letter
    title = "Monthly Finance Report (Continued)" if continued else "Monthly Finance Report"

    pdf.setFillColor(colors.HexColor("#EDF6FF"))
    pdf.rect(0, 0, page_width, page_height, stroke=0, fill=1)

    pdf.setFillColor(colors.HexColor("#1E3A8A"))
    pdf.rect(0, page_height - 98, page_width, 98, stroke=0, fill=1)

    _draw_pdf_logo(pdf, 42, page_height - 34, text_color=colors.white)

    pdf.setFillColor(colors.HexColor("#EFF6FF"))
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(220, page_height - 40, title)
    pdf.setFont("Helvetica", 10)
    pdf.drawString(220, page_height - 57, f"User: {user.username}")
    pdf.drawString(220, page_height - 73, f"Month: {report['year']}-{str(report['month']).zfill(2)}")

    pdf.setFillColor(colors.HexColor("#1E3A8A"))
    pdf.setFont("Helvetica", 9)
    pdf.drawRightString(page_width - 32, 20, f"Page {page_number}")
    return page_height - 124


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ["name"]

    def get_queryset(self):
        seed_default_categories()
        user = self.request.user
        if user.is_staff:
            qs = Category.objects.all()
        else:
            qs = Category.objects.filter(is_default=True) | Category.objects.filter(owner=user)

        txn_type = self.request.query_params.get("txn_type")
        if txn_type == Transaction.INCOME:
            qs = qs.filter(name__iexact=INCOME_CATEGORY, owner__isnull=True, is_default=True)
        elif txn_type == Transaction.EXPENSE:
            qs = qs.exclude(name__iexact=INCOME_CATEGORY)
        return qs.order_by("name")

    def perform_create(self, serializer):
        name = serializer.validated_data.get("name", "").strip()
        if name.lower() == INCOME_CATEGORY.lower():
            raise ValidationError({"name": "Salary is reserved for income and already available."})
        serializer.save(owner=self.request.user, is_default=False)

    def perform_destroy(self, instance):
        if instance.is_default:
            raise permissions.PermissionDenied("Default categories cannot be deleted.")
        if instance.owner != self.request.user and not self.request.user.is_staff:
            raise permissions.PermissionDenied("Not allowed.")
        instance.delete()


class AccountViewSet(viewsets.ModelViewSet):
    serializer_class = AccountSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]
    search_fields = ["name", "account_type", "currency"]
    ordering_fields = ["name", "opening_balance", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        qs = Account.objects.all()
        if not self.request.user.is_staff:
            qs = qs.filter(owner=self.request.user)
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=_to_bool(is_active))
        return qs

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["get"])
    def transactions(self, request, pk=None):
        account = self.get_object()
        qs = account.transactions.select_related("category", "account").order_by("-date", "-created_at")

        year = request.query_params.get("year")
        if year:
            qs = qs.filter(date__year=year)
        month = request.query_params.get("month")
        if month:
            qs = qs.filter(date__month=month)
        txn_type = request.query_params.get("txn_type")
        if txn_type:
            qs = qs.filter(txn_type=txn_type)

        total_income = qs.filter(txn_type=Transaction.INCOME).aggregate(total=Sum("amount"))["total"] or Decimal("0")
        total_expense = qs.filter(txn_type=Transaction.EXPENSE).aggregate(total=Sum("amount"))["total"] or Decimal("0")

        serialized_transactions = TransactionSerializer(qs[:50], many=True).data
        return Response(
            {
                "wallet": AccountSerializer(account).data,
                "summary": {
                    "total_income": total_income,
                    "total_expense": total_expense,
                    "net": total_income - total_expense,
                },
                "count": qs.count(),
                "results": serialized_transactions,
            }
        )


class RecurringTransactionViewSet(viewsets.ModelViewSet):
    serializer_class = RecurringTransactionSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]
    search_fields = ["notes", "category__name", "account__name", "frequency", "txn_type"]
    ordering_fields = ["next_run_date", "amount", "created_at"]
    ordering = ["next_run_date", "-created_at"]

    def get_queryset(self):
        qs = RecurringTransaction.objects.select_related("category", "account", "owner")
        if not self.request.user.is_staff:
            qs = qs.filter(owner=self.request.user)
        txn_type = self.request.query_params.get("txn_type")
        if txn_type:
            qs = qs.filter(txn_type=txn_type)
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=_to_bool(is_active))
        return qs

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=False, methods=["post"])
    def run_due(self, request):
        as_of = request.data.get("as_of")
        target_date = date.today()
        if as_of:
            try:
                target_date = date.fromisoformat(str(as_of))
            except ValueError:
                raise ValidationError({"as_of": "Expected YYYY-MM-DD format."})

        requested_all_users = _to_bool(request.data.get("all_users"), default=False)
        requested_user_id = request.data.get("user_id")

        user_id = None
        if request.user.is_staff:
            if requested_all_users:
                user_id = None
            elif requested_user_id:
                try:
                    user_id = int(requested_user_id)
                except (TypeError, ValueError):
                    raise ValidationError({"user_id": "Expected a valid integer user id."})
            else:
                user_id = request.user.id
        else:
            user_id = request.user.id

        result = process_due_recurring_transactions(user=request.user, user_id=user_id, as_of=target_date)
        result["scope"] = "all_users" if user_id is None else f"user:{user_id}"
        result["as_of"] = target_date.isoformat()
        return Response(result)


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]
    search_fields = ["notes", "category__name", "txn_type"]
    ordering_fields = ["date", "amount", "created_at"]
    ordering = ["-date"]

    def get_queryset(self):
        seed_default_categories()
        qs = Transaction.objects.select_related("category", "owner", "account")
        if self.request.user.is_staff:
            qs = qs.all()
        else:
            qs = qs.filter(owner=self.request.user)

        txn_type = self.request.query_params.get("txn_type")
        if txn_type:
            qs = qs.filter(txn_type=txn_type)

        year = self.request.query_params.get("year")
        if year:
            qs = qs.filter(date__year=year)
        month = self.request.query_params.get("month")
        if month:
            qs = qs.filter(date__month=month)
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category_id=category)
        account = self.request.query_params.get("account")
        if account:
            qs = qs.filter(account_id=account)
        return qs

    def perform_create(self, serializer):
        seed_default_categories()
        serializer.save(owner=self.request.user)


class FinancialGoalViewSet(viewsets.ModelViewSet):
    serializer_class = FinancialGoalSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]
    search_fields = ["name", "status", "notes"]
    ordering_fields = ["target_date", "target_amount", "current_amount", "created_at", "updated_at"]
    ordering = ["status", "target_date", "-created_at"]

    def get_queryset(self):
        qs = FinancialGoal.objects.select_related("linked_account", "owner").prefetch_related("contributions")
        if not self.request.user.is_staff:
            qs = qs.filter(owner=self.request.user)
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["post"])
    def contribute(self, request, pk=None):
        goal = self.get_object()
        serializer = GoalContributionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        contribution = GoalContribution.objects.create(
            goal=goal,
            amount=serializer.validated_data["amount"],
            contribution_date=serializer.validated_data.get("contribution_date", date.today()),
            notes=serializer.validated_data.get("notes", ""),
        )
        goal.current_amount = (goal.current_amount or Decimal("0")) + contribution.amount
        if goal.current_amount >= goal.target_amount:
            goal.status = FinancialGoal.STATUS_COMPLETED
        elif goal.status == FinancialGoal.STATUS_COMPLETED:
            goal.status = FinancialGoal.STATUS_ACTIVE
        goal.save(update_fields=["current_amount", "status", "updated_at"])

        return Response(
            {
                "detail": "Contribution added.",
                "contribution": GoalContributionSerializer(contribution).data,
                "goal": FinancialGoalSerializer(goal, context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED,
        )


class MonthlyBudgetViewSet(viewsets.ModelViewSet):
    serializer_class = MonthlyBudgetSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]
    ordering = ["-year", "-month"]

    def get_queryset(self):
        qs = MonthlyBudget.objects.prefetch_related("category_budgets__category")
        if not self.request.user.is_staff:
            qs = qs.filter(owner=self.request.user)
        year = self.request.query_params.get("year")
        month = self.request.query_params.get("month")
        if year:
            qs = qs.filter(year=year)
        if month:
            qs = qs.filter(month=month)
        return qs

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["get"])
    def alerts(self, request, pk=None):
        budget = self.get_object()
        spent_total = (
            Transaction.objects.filter(
                owner=budget.owner,
                txn_type=Transaction.EXPENSE,
                date__year=budget.year,
                date__month=budget.month,
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0")
        )
        alerts = []
        if spent_total > budget.total_budget:
            alerts.append(
                f"Total monthly budget exceeded by {spent_total - budget.total_budget:.2f}."
            )

        by_category = (
            Transaction.objects.filter(
                owner=budget.owner,
                txn_type=Transaction.EXPENSE,
                date__year=budget.year,
                date__month=budget.month,
            )
            .values("category")
            .annotate(total=Sum("amount"))
        )
        limits = {cb.category_id: cb.limit_amount for cb in budget.category_budgets.all()}
        for row in by_category:
            category_id = row["category"]
            spent = row["total"] or Decimal("0")
            if category_id in limits and spent > limits[category_id]:
                category = Category.objects.filter(id=category_id).first()
                category_name = category.name if category else "Unknown"
                alerts.append(
                    f"{category_name} budget exceeded by {spent - limits[category_id]:.2f}."
                )

        return Response({"alerts": alerts})


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def health_check(request):
    return Response(
        {
            "status": "ok",
            "service": "finance-tracker-api",
            "timestamp": now().isoformat(),
        }
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def dashboard_summary(request):
    user = request.user
    year = int(request.query_params.get("year", now().year))
    month = int(request.query_params.get("month", now().month))

    base = Transaction.objects.filter(owner=user, date__year=year, date__month=month)
    income = base.filter(txn_type=Transaction.INCOME).aggregate(total=Sum("amount"))["total"] or Decimal("0")
    expense = base.filter(txn_type=Transaction.EXPENSE).aggregate(total=Sum("amount"))["total"] or Decimal("0")

    recent_transactions = (
        base.select_related("category").order_by("-created_at")[:5]
    )
    recent_data = TransactionSerializer(recent_transactions, many=True).data

    top_categories = (
        base.filter(txn_type=Transaction.EXPENSE)
        .values("category__name")
        .annotate(total=Sum("amount"))
        .order_by("-total")[:5]
    )

    monthly_trend = (
        Transaction.objects.filter(owner=user, txn_type=Transaction.EXPENSE)
        .annotate(month_label=TruncMonth("date"))
        .values("month_label")
        .annotate(total=Sum("amount"))
        .order_by("month_label")
    )
    trend_data = [
        {"month": item["month_label"].strftime("%Y-%m"), "expense": item["total"]}
        for item in monthly_trend
    ]

    account_balances = []
    for account in Account.objects.filter(owner=user, is_active=True):
        income_total = (
            account.transactions.filter(txn_type=Transaction.INCOME).aggregate(total=Sum("amount"))["total"]
            or Decimal("0")
        )
        expense_total = (
            account.transactions.filter(txn_type=Transaction.EXPENSE).aggregate(total=Sum("amount"))["total"]
            or Decimal("0")
        )
        account_balances.append(
            {
                "id": account.id,
                "name": account.name,
                "currency": account.currency,
                "current_balance": account.opening_balance + income_total - expense_total,
            }
        )

    goals = FinancialGoal.objects.filter(owner=user).order_by("status", "target_date", "-created_at")[:5]
    goals_data = []
    for goal in goals:
        if goal.target_amount > 0:
            progress = float(min((goal.current_amount / goal.target_amount) * Decimal("100"), Decimal("100")))
        else:
            progress = 0.0
        goals_data.append(
            {
                "id": goal.id,
                "name": goal.name,
                "status": goal.status,
                "target_amount": goal.target_amount,
                "current_amount": goal.current_amount,
                "progress_percentage": progress,
            }
        )

    return Response(
        {
            "total_income": income,
            "total_expense": expense,
            "savings": income - expense,
            "recent_transactions": recent_data,
            "top_spending_categories": list(top_categories),
            "spending_trend": trend_data,
            "account_balances": account_balances,
            "goals": goals_data,
        }
    )


def _to_bool(value, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def ai_categorize(request):
    seed_default_categories()
    serializer = AICategorizeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    payload = serializer.validated_data
    suggestion = suggest_category(
        request.user,
        description=payload.get("description", ""),
        txn_type=payload.get("txn_type", Transaction.EXPENSE),
    )
    category = suggestion.get("category")

    return Response(
        {
            "category_id": category.id if category else None,
            "category_name": category.name if category else None,
            "confidence": suggestion["confidence"],
            "needs_feedback": suggestion["needs_feedback"],
            "model_version": suggestion["model_version"],
            "sample_count": suggestion["sample_count"],
            "retrained": suggestion["retrained"],
        }
    )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def ai_categorize_feedback(request):
    seed_default_categories()
    serializer = AICategoryFeedbackSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    payload = serializer.validated_data

    predicted = payload.get("predicted_category")
    corrected = payload["corrected_category"]

    if not is_category_accessible(request.user, corrected):
        raise ValidationError({"corrected_category": "Category is not accessible."})

    was_accepted = payload.get("was_accepted", False)
    if predicted and corrected and predicted.id == corrected.id:
        was_accepted = True

    state = CategoryModelState.objects.filter(owner=request.user).first()
    feedback = CategoryFeedback.objects.create(
        owner=request.user,
        description=payload["description"],
        predicted_category=predicted,
        corrected_category=corrected,
        transaction=payload.get("transaction"),
        confidence=payload.get("confidence"),
        was_accepted=was_accepted,
        source=payload.get("source", CategoryFeedback.SOURCE_MANUAL),
        model_version=state.version if state else None,
    )

    model_state, retrained = update_feedback_counter_and_maybe_retrain(request.user)
    return Response(
        {
            "detail": "Feedback recorded.",
            "feedback_id": feedback.id,
            "retrained": retrained,
            "model_version": model_state.version,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def ai_retrain(request):
    force = _to_bool(request.data.get("force"), default=True)

    if request.user.is_staff and _to_bool(request.data.get("all_users")):
        target_user_id = request.data.get("user_id")
        target_user_id = int(target_user_id) if target_user_id else None
        processed, retrained = retrain_all_user_models(force=force, user_id=target_user_id)
        return Response(
            {
                "detail": "Retrain completed.",
                "scope": "all_users" if target_user_id is None else f"user:{target_user_id}",
                "processed_users": processed,
                "retrained_users": retrained,
            }
        )

    processed, retrained = retrain_all_user_models(force=force, user_id=request.user.id)
    state = CategoryModelState.objects.filter(owner=request.user).first()
    return Response(
        {
            "detail": "Retrain completed.",
            "scope": f"user:{request.user.id}",
            "processed_users": processed,
            "retrained_users": retrained,
            "model_version": state.version if state else None,
            "sample_count": state.sample_count if state else 0,
        }
    )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def ai_receipt_ingest(request):
    seed_default_categories()
    max_upload_mb = int(getattr(settings, "AI_RECEIPT_MAX_UPLOAD_MB", 8))
    serializer = ReceiptIngestionSerializer(
        data=request.data, context={"max_upload_mb": max_upload_mb}
    )
    serializer.is_valid(raise_exception=True)

    payload = serializer.validated_data
    upload = payload["file"]
    create_transaction = payload.get("create_transaction", False)
    txn_type = payload.get("txn_type", Transaction.EXPENSE)

    ingestion = ReceiptIngestion.objects.create(
        owner=request.user,
        file_name=upload.name,
        txn_type=txn_type,
    )

    parsed = {}
    try:
        raw_text, ocr_engine = extract_text_from_upload(upload)
        parsed = parse_receipt_text(raw_text)
        description_for_ai = (
            parsed.get("description")
            or parsed.get("merchant")
            or (raw_text or "")[:180]
        )
        suggestion = suggest_category(request.user, description_for_ai, txn_type=txn_type)
        suggested_category = suggestion.get("category")

        ingestion.raw_text = (raw_text or "")[:25000]
        ingestion.merchant = parsed.get("merchant") or ""
        ingestion.detected_amount = parsed.get("amount")
        ingestion.detected_date = parsed.get("date")
        ingestion.suggested_category = suggested_category
        ingestion.category_confidence = suggestion.get("confidence")
        ingestion.metadata = {
            "ocr_engine": ocr_engine,
            "text_length": len(raw_text or ""),
            "needs_feedback": suggestion.get("needs_feedback", True),
            "model_version": suggestion.get("model_version"),
            "suggested_description": description_for_ai,
        }
        ingestion.status = ReceiptIngestion.STATUS_PARSED

        if create_transaction:
            if not parsed.get("amount") or not parsed.get("date"):
                ingestion.status = ReceiptIngestion.STATUS_FAILED
                ingestion.error_message = (
                    "Could not detect both amount and date from receipt. "
                    "Upload a clearer receipt or create transaction manually."
                )
            else:
                final_category = suggested_category
                if not final_category:
                    final_category = (
                        Category.objects.filter(name__iexact="Others", is_default=True).first()
                        or Category.objects.filter(is_default=True).exclude(name__iexact=INCOME_CATEGORY).first()
                    )

                transaction_notes = description_for_ai or "Imported from receipt"
                created_tx = Transaction.objects.create(
                    owner=request.user,
                    txn_type=txn_type,
                    amount=parsed["amount"],
                    category=final_category,
                    date=parsed["date"],
                    notes=transaction_notes,
                )
                ingestion.created_transaction = created_tx
                ingestion.status = ReceiptIngestion.STATUS_IMPORTED

                if txn_type == Transaction.EXPENSE and final_category:
                    CategoryFeedback.objects.create(
                        owner=request.user,
                        description=transaction_notes,
                        predicted_category=suggested_category,
                        corrected_category=final_category,
                        transaction=created_tx,
                        confidence=suggestion.get("confidence"),
                        was_accepted=bool(
                            suggested_category and suggested_category.id == final_category.id
                        ),
                        source=CategoryFeedback.SOURCE_RECEIPT,
                        model_version=suggestion.get("model_version"),
                        metadata={"receipt_ingestion_id": ingestion.id},
                    )
                    update_feedback_counter_and_maybe_retrain(request.user)
    except RuntimeError as exc:
        ingestion.status = ReceiptIngestion.STATUS_FAILED
        ingestion.error_message = str(exc)
        ingestion.save()
        result = ReceiptIngestionResultSerializer(ingestion).data
        result["raw_text_preview"] = ingestion.raw_text[:1000]
        return Response(result, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    except Exception as exc:
        ingestion.status = ReceiptIngestion.STATUS_FAILED
        ingestion.error_message = f"Receipt parsing failed: {exc}"
        ingestion.save()
        result = ReceiptIngestionResultSerializer(ingestion).data
        result["raw_text_preview"] = ingestion.raw_text[:1000]
        return Response(result, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    ingestion.save()
    result = ReceiptIngestionResultSerializer(ingestion).data
    result["raw_text_preview"] = ingestion.raw_text[:1000]
    if parsed:
        result["suggested_description"] = ingestion.metadata.get("suggested_description")

    response_status = (
        status.HTTP_201_CREATED
        if create_transaction and ingestion.status == ReceiptIngestion.STATUS_IMPORTED
        else (
            status.HTTP_422_UNPROCESSABLE_ENTITY
            if create_transaction and ingestion.status == ReceiptIngestion.STATUS_FAILED
            else status.HTTP_200_OK
        )
    )
    return Response(result, status=response_status)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def monthly_report(request):
    user = request.user
    year = int(request.query_params.get("year", date.today().year))
    month = int(request.query_params.get("month", date.today().month))
    return Response(_build_monthly_report(user, year, month))


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def export_csv(request):
    user = request.user
    year = request.query_params.get("year")
    month = request.query_params.get("month")

    qs = Transaction.objects.filter(owner=user)
    if year:
        qs = qs.filter(date__year=year)
    if month:
        qs = qs.filter(date__month=month)

    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = "attachment; filename=transactions.csv"
    writer = csv.writer(response)
    writer.writerow(["Type", "Amount", "Category", "Date", "Notes"])
    for tx in qs.select_related("category"):
        writer.writerow([tx.txn_type, tx.amount, tx.category.name if tx.category else "", tx.date, tx.notes])
    return response


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def export_pdf(request):
    user = request.user
    year = int(request.query_params.get("year", date.today().year))
    month = int(request.query_params.get("month", date.today().month))
    report = _build_monthly_report(user, year, month)
    transactions = list(
        Transaction.objects.filter(owner=user, date__year=year, date__month=month)
        .select_related("category")
        .order_by("-date", "-created_at")
    )

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    page_number = 1
    y = _draw_pdf_header(pdf, user, report, page_number, continued=False)

    # Summary cards
    card_w = 170
    card_h = 56
    gap = 12
    left = 36
    summary_cards = [
        ("Income", _money(report["total_income"]), colors.HexColor("#16A34A")),
        ("Expense", _money(report["total_expense"]), colors.HexColor("#DC2626")),
        ("Savings", _money(report["savings"]), colors.HexColor("#2563EB")),
    ]
    for index, (label, value, accent) in enumerate(summary_cards):
        x = left + index * (card_w + gap)
        pdf.setFillColor(colors.white)
        pdf.roundRect(x, y - card_h, card_w, card_h, 8, stroke=0, fill=1)
        pdf.setFillColor(accent)
        pdf.rect(x, y - card_h, 4, card_h, stroke=0, fill=1)
        pdf.setFillColor(colors.HexColor("#334155"))
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(x + 10, y - 20, label)
        pdf.setFillColor(colors.HexColor("#0F172A"))
        pdf.setFont("Helvetica-Bold", 13)
        pdf.drawString(x + 10, y - 39, value)

    y -= card_h + 22

    # Category breakdown section
    section_h = 96
    pdf.setFillColor(colors.white)
    pdf.roundRect(36, y - section_h, 540, section_h, 8, stroke=0, fill=1)
    pdf.setFillColor(colors.HexColor("#1E3A8A"))
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(48, y - 18, "Expense Category Breakdown")
    pdf.setFillColor(colors.HexColor("#334155"))
    pdf.setFont("Helvetica", 10)
    category_rows = report["category_breakdown"][:4]
    if not category_rows:
        pdf.drawString(48, y - 38, "No expense categories in this month.")
    else:
        line_y = y - 38
        for item in category_rows:
            category_name = item["category__name"] or "Uncategorized"
            amount = _money(item["total"])
            pdf.drawString(48, line_y, f"- {category_name}")
            pdf.drawRightString(560, line_y, amount)
            line_y -= 16

    y -= section_h + 20

    # Transaction history table
    pdf.setFillColor(colors.HexColor("#1E3A8A"))
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(36, y, "Transaction History")
    y -= 12

    table_x = 36
    table_widths = [75, 58, 105, 84, 218]
    headers = ["Date", "Type", "Category", "Amount", "Notes"]
    row_h = 21

    def draw_table_header(current_y: float) -> float:
        pdf.setFillColor(colors.HexColor("#2563EB"))
        pdf.roundRect(table_x, current_y - row_h, sum(table_widths), row_h, 5, stroke=0, fill=1)
        pdf.setFillColor(colors.white)
        pdf.setFont("Helvetica-Bold", 9)
        cursor = table_x + 6
        for idx, header in enumerate(headers):
            pdf.drawString(cursor, current_y - 14, header)
            cursor += table_widths[idx]
        return current_y - row_h

    y -= 4
    y = draw_table_header(y)

    if not transactions:
        pdf.setFillColor(colors.HexColor("#334155"))
        pdf.setFont("Helvetica", 10)
        pdf.drawString(table_x + 8, y - 16, "No transactions available for this month.")
        y -= 24
    else:
        for index, tx in enumerate(transactions):
            if y < 58:
                pdf.showPage()
                page_number += 1
                y = _draw_pdf_header(pdf, user, report, page_number, continued=True)
                pdf.setFillColor(colors.HexColor("#1E3A8A"))
                pdf.setFont("Helvetica-Bold", 12)
                pdf.drawString(36, y, "Transaction History")
                y -= 16
                y = draw_table_header(y)

            row_bg = colors.HexColor("#F8FBFF") if index % 2 == 0 else colors.white
            pdf.setFillColor(row_bg)
            pdf.rect(table_x, y - row_h, sum(table_widths), row_h, stroke=0, fill=1)

            tx_type = tx.txn_type.capitalize()
            category_name = tx.category.name if tx.category else "Uncategorized"
            amount_value = f"{'+' if tx.txn_type == Transaction.INCOME else '-'}{_money(tx.amount)}"
            notes = _truncate(tx.notes, 42) if tx.notes else "-"

            row_values = [
                tx.date.strftime("%Y-%m-%d"),
                tx_type,
                _truncate(category_name, 16),
                amount_value,
                notes,
            ]
            pdf.setFillColor(colors.HexColor("#0F172A"))
            pdf.setFont("Helvetica", 9)
            cursor = table_x + 6
            for col_idx, value in enumerate(row_values):
                pdf.drawString(cursor, y - 14, value)
                cursor += table_widths[col_idx]
            y -= row_h

    pdf.save()
    buffer.seek(0)

    response = HttpResponse(buffer.read(), content_type="application/pdf")
    response["Content-Disposition"] = "attachment; filename=monthly_report.pdf"
    return response


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def email_report(request):
    email = request.data.get("email")
    if not email:
        return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

    if settings.EMAIL_BACKEND == "django.core.mail.backends.console.EmailBackend":
        return Response(
            {
                "detail": (
                    "Email backend is set to console mode. Configure SMTP settings in "
                    "environment variables to send real emails."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
        return Response(
            {"detail": "SMTP credentials are missing. Set EMAIL_HOST_USER and EMAIL_HOST_PASSWORD."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    year = int(request.query_params.get("year", date.today().year))
    month = int(request.query_params.get("month", date.today().month))
    report_data = _build_monthly_report(request.user, year, month)
    body = (
        f"Monthly report\n"
        f"Income: {report_data['total_income']}\n"
        f"Expense: {report_data['total_expense']}\n"
        f"Savings: {report_data['savings']}\n"
    )
    message = EmailMessage(
        subject="Your Monthly Finance Report",
        body=body,
        to=[email],
    )
    try:
        sent_count = message.send(fail_silently=False)
    except Exception as exc:
        if isinstance(exc, smtplib.SMTPAuthenticationError) or "5.7.8" in str(exc):
            return Response(
                {
                    "detail": (
                        "SMTP authentication failed. For Gmail, use a 16-character App Password "
                        "(no spaces) and ensure 2-Step Verification is enabled."
                    )
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(
            {"detail": f"Email sending failed: {str(exc)}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    if sent_count < 1:
        return Response(
            {"detail": "Email was not accepted by SMTP server."},
            status=status.HTTP_502_BAD_GATEWAY,
        )
    return Response({"detail": "Email report sent successfully."})
