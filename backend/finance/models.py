from django.conf import settings
from django.db import models


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


class Transaction(models.Model):
    INCOME = "income"
    EXPENSE = "expense"
    TXN_TYPE_CHOICES = ((INCOME, "Income"), (EXPENSE, "Expense"))

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="transactions")
    txn_type = models.CharField(max_length=10, choices=TXN_TYPE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name="transactions")
    date = models.DateField()
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-date", "-created_at")

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
