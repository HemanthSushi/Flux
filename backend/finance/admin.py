from django.contrib import admin

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

admin.site.register(Account)
admin.site.register(Category)
admin.site.register(Transaction)
admin.site.register(MonthlyBudget)
admin.site.register(CategoryBudget)
admin.site.register(CategoryFeedback)
admin.site.register(CategoryModelState)
admin.site.register(ReceiptIngestion)
admin.site.register(RecurringTransaction)
admin.site.register(FinancialGoal)
admin.site.register(GoalContribution)
