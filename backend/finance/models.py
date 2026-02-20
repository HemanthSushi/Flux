from datetime import date

from django.conf import settings
from django.db import models
from django.db.models import Q


class Category(models.Model):
    name = models.CharField(max_length=80)
    is_default = models.BooleanField(default=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="categories",
        null=True,
        blank=True,
    )

    class Meta:
        unique_together = ("name", "owner")
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class Account(models.Model):
    TYPE_CASH = "cash"
    TYPE_BANK = "bank"
    TYPE_WALLET = "wallet"
    TYPE_CREDIT = "credit"
    TYPE_OTHER = "other"
    ACCOUNT_TYPE_CHOICES = (
        (TYPE_CASH, "Cash"),
        (TYPE_BANK, "Bank"),
        (TYPE_WALLET, "Wallet"),
        (TYPE_CREDIT, "Credit Card"),
        (TYPE_OTHER, "Other"),
    )

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="accounts")
    name = models.CharField(max_length=80)
    account_type = models.CharField(max_length=20, choices=ACCOUNT_TYPE_CHOICES, default=TYPE_BANK)
    currency = models.CharField(max_length=10, default="INR")
    opening_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("owner", "name")
        ordering = ("name",)

    def __str__(self) -> str:
        return f"{self.owner.username}:{self.name}"


class Transaction(models.Model):
    INCOME = "income"
    EXPENSE = "expense"
    TXN_TYPE_CHOICES = ((INCOME, "Income"), (EXPENSE, "Expense"))

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="transactions")
    txn_type = models.CharField(max_length=10, choices=TXN_TYPE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name="transactions")
    account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transactions",
    )
    source_recurring = models.ForeignKey(
        "RecurringTransaction",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_transactions",
    )
    recurrence_for_date = models.DateField(null=True, blank=True)
    date = models.DateField()
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-date", "-created_at")
        constraints = [
            models.UniqueConstraint(
                fields=("source_recurring", "recurrence_for_date"),
                condition=Q(source_recurring__isnull=False, recurrence_for_date__isnull=False),
                name="uniq_recurring_generated_date",
            )
        ]

    def __str__(self) -> str:
        return f"{self.owner.username} {self.txn_type} {self.amount}"


class MonthlyBudget(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="monthly_budgets")
    year = models.PositiveIntegerField()
    month = models.PositiveIntegerField()
    total_budget = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        unique_together = ("owner", "year", "month")
        ordering = ("-year", "-month")

    def __str__(self) -> str:
        return f"{self.owner.username} {self.year}-{self.month}"


class RecurringTransaction(models.Model):
    FREQ_DAILY = "daily"
    FREQ_WEEKLY = "weekly"
    FREQ_MONTHLY = "monthly"
    FREQ_YEARLY = "yearly"
    FREQUENCY_CHOICES = (
        (FREQ_DAILY, "Daily"),
        (FREQ_WEEKLY, "Weekly"),
        (FREQ_MONTHLY, "Monthly"),
        (FREQ_YEARLY, "Yearly"),
    )

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="recurring_transactions",
    )
    txn_type = models.CharField(max_length=10, choices=Transaction.TXN_TYPE_CHOICES, default=Transaction.EXPENSE)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        related_name="recurring_transactions",
    )
    account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recurring_transactions",
    )
    notes = models.TextField(blank=True)
    frequency = models.CharField(max_length=10, choices=FREQUENCY_CHOICES, default=FREQ_MONTHLY)
    interval = models.PositiveIntegerField(default=1)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    next_run_date = models.DateField()
    last_run_date = models.DateField(null=True, blank=True)
    auto_create = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"Recurring<{self.owner.username}:{self.frequency}:{self.amount}>"


class CategoryBudget(models.Model):
    monthly_budget = models.ForeignKey(
        MonthlyBudget, on_delete=models.CASCADE, related_name="category_budgets"
    )
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="category_budgets")
    limit_amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        unique_together = ("monthly_budget", "category")

    def __str__(self) -> str:
        return f"{self.category.name}: {self.limit_amount}"


class FinancialGoal(models.Model):
    STATUS_ACTIVE = "active"
    STATUS_COMPLETED = "completed"
    STATUS_PAUSED = "paused"
    STATUS_CHOICES = (
        (STATUS_ACTIVE, "Active"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_PAUSED, "Paused"),
    )

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="financial_goals",
    )
    name = models.CharField(max_length=120)
    target_amount = models.DecimalField(max_digits=12, decimal_places=2)
    current_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    target_date = models.DateField(null=True, blank=True)
    linked_account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="goals",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("owner", "name")
        ordering = ("status", "target_date", "-created_at")

    def __str__(self) -> str:
        return f"Goal<{self.owner.username}:{self.name}>"


class GoalContribution(models.Model):
    goal = models.ForeignKey(
        FinancialGoal,
        on_delete=models.CASCADE,
        related_name="contributions",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    contribution_date = models.DateField(default=date.today)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-contribution_date", "-created_at")

    def __str__(self) -> str:
        return f"GoalContribution<{self.goal_id}:{self.amount}>"


class CategoryModelState(models.Model):
    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="category_model_state",
    )
    model_data = models.JSONField(default=dict, blank=True)
    sample_count = models.PositiveIntegerField(default=0)
    version = models.PositiveIntegerField(default=1)
    feedback_count_since_train = models.PositiveIntegerField(default=0)
    trained_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at",)

    def __str__(self) -> str:
        return f"CategoryModelState<{self.owner.username}>"


class CategoryFeedback(models.Model):
    SOURCE_MANUAL = "manual"
    SOURCE_RECEIPT = "receipt"
    SOURCE_CHOICES = (
        (SOURCE_MANUAL, "Manual"),
        (SOURCE_RECEIPT, "Receipt"),
    )

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="category_feedback_entries",
    )
    description = models.TextField()
    predicted_category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="feedback_predicted",
    )
    corrected_category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="feedback_corrected",
    )
    transaction = models.ForeignKey(
        Transaction,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_feedback_entries",
    )
    confidence = models.FloatField(null=True, blank=True)
    was_accepted = models.BooleanField(default=False)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default=SOURCE_MANUAL)
    model_version = models.PositiveIntegerField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"CategoryFeedback<{self.owner.username}>"


class ReceiptIngestion(models.Model):
    STATUS_PARSED = "parsed"
    STATUS_IMPORTED = "imported"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = (
        (STATUS_PARSED, "Parsed"),
        (STATUS_IMPORTED, "Imported"),
        (STATUS_FAILED, "Failed"),
    )

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="receipt_ingestions",
    )
    file_name = models.CharField(max_length=255)
    raw_text = models.TextField(blank=True)
    merchant = models.CharField(max_length=160, blank=True)
    detected_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    detected_date = models.DateField(null=True, blank=True)
    txn_type = models.CharField(max_length=10, choices=Transaction.TXN_TYPE_CHOICES, default=Transaction.EXPENSE)
    suggested_category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="receipt_suggestions",
    )
    category_confidence = models.FloatField(null=True, blank=True)
    created_transaction = models.ForeignKey(
        Transaction,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="source_receipts",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PARSED)
    error_message = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"ReceiptIngestion<{self.owner.username}:{self.file_name}>"
