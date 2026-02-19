from datetime import date

from django.db.models import Sum
from rest_framework import serializers

from .models import Category, CategoryBudget, MonthlyBudget, Transaction


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "is_default")


class TransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Transaction
        fields = (
            "id",
            "txn_type",
            "amount",
            "category",
            "category_name",
            "date",
            "notes",
            "created_at",
            "updated_at",
        )

    def validate_category(self, value: Category):
        user = self.context["request"].user
        if value and not value.is_default and value.owner != user and not user.is_staff:
            raise serializers.ValidationError("You can only use your own custom categories.")
        return value

    def validate(self, attrs):
        txn_type = attrs.get("txn_type", getattr(self.instance, "txn_type", None))
        category = attrs.get("category", getattr(self.instance, "category", None))

        if not category:
            raise serializers.ValidationError({"category": "Category is required."})

        is_salary = category.name.lower() == "salary"
        if txn_type == Transaction.INCOME:
            if not is_salary or category.owner_id is not None or not category.is_default:
                raise serializers.ValidationError(
                    {"category": "Income category must be the default Salary category."}
                )
        if txn_type == Transaction.EXPENSE and is_salary:
            raise serializers.ValidationError({"category": "Salary category is only for income."})
        return attrs


class CategoryBudgetSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = CategoryBudget
        fields = ("id", "category", "category_name", "limit_amount")


class MonthlyBudgetSerializer(serializers.ModelSerializer):
    category_budgets = CategoryBudgetSerializer(many=True, required=False)
    spent_total = serializers.SerializerMethodField()

    class Meta:
        model = MonthlyBudget
        fields = ("id", "year", "month", "total_budget", "spent_total", "category_budgets")

    def validate_category_budgets(self, value):
        for row in value:
            category = row.get("category")
            if category and category.name.lower() == "salary":
                raise serializers.ValidationError(
                    "Salary category cannot be used in expense budgets."
                )
        return value

    def get_spent_total(self, obj: MonthlyBudget):
        spent = (
            Transaction.objects.filter(
                owner=obj.owner,
                txn_type=Transaction.EXPENSE,
                date__year=obj.year,
                date__month=obj.month,
            ).aggregate(total=Sum("amount"))["total"]
            or 0
        )
        return spent

    def create(self, validated_data):
        category_data = validated_data.pop("category_budgets", [])
        budget = MonthlyBudget.objects.create(**validated_data)
        for row in category_data:
            CategoryBudget.objects.create(monthly_budget=budget, **row)
        return budget

    def update(self, instance, validated_data):
        category_data = validated_data.pop("category_budgets", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if category_data is not None:
            instance.category_budgets.all().delete()
            for row in category_data:
                CategoryBudget.objects.create(monthly_budget=instance, **row)
        return instance


class MonthlySummarySerializer(serializers.Serializer):
    month = serializers.IntegerField()
    year = serializers.IntegerField()
    total_income = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_expense = serializers.DecimalField(max_digits=12, decimal_places=2)
    savings = serializers.DecimalField(max_digits=12, decimal_places=2)


class DateRangeFilterSerializer(serializers.Serializer):
    year = serializers.IntegerField(required=False, default=date.today().year)
    month = serializers.IntegerField(required=False, min_value=1, max_value=12)
