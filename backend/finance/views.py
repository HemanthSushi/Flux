import csv
import smtplib
from datetime import date
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
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import Category, CategoryBudget, MonthlyBudget, Transaction
from .permissions import IsOwnerOrAdmin
from .serializers import CategorySerializer, MonthlyBudgetSerializer, TransactionSerializer

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


def _draw_pdf_logo(pdf, x: float, y: float) -> None:
    # y is top coordinate for the logo block.
    icon_size = 24
    icon_y = y - icon_size
    green = colors.HexColor("#5D826A")
    slate = colors.HexColor("#5E6066")

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

    pdf.setFillColor(slate)
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

    pdf.setFillColor(colors.white)
    pdf.roundRect(30, page_height - 84, 170, 58, 10, stroke=0, fill=1)
    _draw_pdf_logo(pdf, 42, page_height - 34)

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


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]
    search_fields = ["notes", "category__name", "txn_type"]
    ordering_fields = ["date", "amount", "created_at"]
    ordering = ["-date"]

    def get_queryset(self):
        seed_default_categories()
        qs = Transaction.objects.select_related("category", "owner")
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
        return qs

    def perform_create(self, serializer):
        seed_default_categories()
        serializer.save(owner=self.request.user)


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

    return Response(
        {
            "total_income": income,
            "total_expense": expense,
            "savings": income - expense,
            "recent_transactions": recent_data,
            "top_spending_categories": list(top_categories),
            "spending_trend": trend_data,
        }
    )


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
