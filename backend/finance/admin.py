from django.contrib import admin

from .models import Category, CategoryBudget, MonthlyBudget, Transaction

admin.site.register(Category)
admin.site.register(Transaction)
admin.site.register(MonthlyBudget)
admin.site.register(CategoryBudget)
