from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CategoryViewSet,
    MonthlyBudgetViewSet,
    TransactionViewSet,
    dashboard_summary,
    email_report,
    export_csv,
    export_pdf,
    monthly_report,
)

router = DefaultRouter()
router.register(r"categories", CategoryViewSet, basename="category")
router.register(r"transactions", TransactionViewSet, basename="transaction")
router.register(r"budgets", MonthlyBudgetViewSet, basename="budget")

urlpatterns = [
    path("", include(router.urls)),
    path("reports/monthly/", monthly_report, name="monthly-report"),
    path("reports/export/csv/", export_csv, name="export-csv"),
    path("reports/export/pdf/", export_pdf, name="export-pdf"),
    path("reports/email/", email_report, name="email-report"),
    path("dashboard/summary/", dashboard_summary, name="dashboard-summary"),
]
