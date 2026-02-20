from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AccountViewSet,
    CategoryViewSet,
    FinancialGoalViewSet,
    MonthlyBudgetViewSet,
    RecurringTransactionViewSet,
    TransactionViewSet,
    ai_categorize,
    ai_categorize_feedback,
    ai_receipt_ingest,
    ai_retrain,
    dashboard_summary,
    email_report,
    export_csv,
    export_pdf,
    health_check,
    monthly_report,
)

router = DefaultRouter()
router.register(r"wallets", AccountViewSet, basename="wallet")
router.register(r"categories", CategoryViewSet, basename="category")
router.register(r"transactions", TransactionViewSet, basename="transaction")
router.register(r"recurring-transactions", RecurringTransactionViewSet, basename="recurring-transaction")
router.register(r"budgets", MonthlyBudgetViewSet, basename="budget")
router.register(r"goals", FinancialGoalViewSet, basename="goal")

urlpatterns = [
    path("health/", health_check, name="health-check"),
    path("", include(router.urls)),
    path("ai/categorize/", ai_categorize, name="ai-categorize"),
    path("ai/categorize/feedback/", ai_categorize_feedback, name="ai-categorize-feedback"),
    path("ai/retrain/", ai_retrain, name="ai-retrain"),
    path("ai/receipt/ingest/", ai_receipt_ingest, name="ai-receipt-ingest"),
    path("reports/monthly/", monthly_report, name="monthly-report"),
    path("reports/export/csv/", export_csv, name="export-csv"),
    path("reports/export/pdf/", export_pdf, name="export-pdf"),
    path("reports/email/", email_report, name="email-report"),
    path("dashboard/summary/", dashboard_summary, name="dashboard-summary"),
]
