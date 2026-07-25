from datetime import date
from decimal import Decimal

from django.db.models import Sum
from rest_framework import serializers

from .models import (
    Account,
    Category,
    CategoryBudget,
    CategoryFeedback,
    FinancialGoal,
    GoalContribution,
    MonthlyBudget,
    ReceiptIngestion,
    RecurringTransaction,
    Transaction,
)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "is_default")


class AccountSerializer(serializers.ModelSerializer):
    current_balance = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = (
            "id",
            "name",
            "account_type",
            "currency",
            "opening_balance",
            "current_balance",
            "is_active",
            "created_at",
            "updated_at",
        )

    def get_current_balance(self, obj: Account):
        totals = obj.transactions.values("txn_type").annotate(total=Sum("amount"))
        income = Decimal("0")
        expense = Decimal("0")
        for row in totals:
            if row["txn_type"] == Transaction.INCOME:
                income = row["total"] or Decimal("0")
            if row["txn_type"] == Transaction.EXPENSE:
                expense = row["total"] or Decimal("0")
        return obj.opening_balance + income - expense

    def validate_currency(self, value: str):
        normalized = (value or "").upper().strip()
        if normalized != "INR":
            raise serializers.ValidationError("Only INR is supported for wallets.")
        return "INR"


class TransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True)
    account_type = serializers.CharField(source="account.account_type", read_only=True)
    account_currency = serializers.CharField(source="account.currency", read_only=True)

    class Meta:
        model = Transaction
        fields = (
            "id",
            "txn_type",
            "amount",
            "category",
            "category_name",
            "account",
            "account_name",
            "account_type",
            "account_currency",
            "date",
            "notes",
            "source_recurring",
            "recurrence_for_date",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("source_recurring", "recurrence_for_date")

    def validate_category(self, value: Category):
        user = self.context["request"].user
        if value and not value.is_default and value.owner != user and not user.is_staff:
            raise serializers.ValidationError("You can only use your own custom categories.")
        return value

    def validate_account(self, value: Account | None):
        if value is None:
            return value
        user = self.context["request"].user
        if value.owner_id != user.id and not user.is_staff:
            raise serializers.ValidationError("Account is not accessible.")
        return value

    def validate(self, attrs):
        txn_type = attrs.get("txn_type", getattr(self.instance, "txn_type", None))
        category = attrs.get("category", getattr(self.instance, "category", None))
        account = attrs.get("account", getattr(self.instance, "account", None))
        owner = getattr(self.instance, "owner", self.context["request"].user)

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
        if account and account.owner_id != owner.id:
            raise serializers.ValidationError(
                {"account": "Wallet must belong to the same user as the transaction."}
            )

        if txn_type == Transaction.EXPENSE and account:
            txns = account.transactions.all()
            if self.instance and self.instance.pk:
                txns = txns.exclude(pk=self.instance.pk)
            totals = txns.values("txn_type").annotate(total=Sum("amount"))
            income = Decimal("0")
            expense = Decimal("0")
            for row in totals:
                if row["txn_type"] == Transaction.INCOME:
                    income = row["total"] or Decimal("0")
                elif row["txn_type"] == Transaction.EXPENSE:
                    expense = row["total"] or Decimal("0")
            balance_excluding_self = account.opening_balance + income - expense
            amount = attrs.get("amount", getattr(self.instance, "amount", Decimal("0")))
            if balance_excluding_self < amount:
                raise serializers.ValidationError(
                    {"account": f"Insufficient balance in wallet '{account.name}'. Available balance is {balance_excluding_self} INR."}
                )

        return attrs


class RecurringTransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True)

    class Meta:
        model = RecurringTransaction
        fields = (
            "id",
            "txn_type",
            "amount",
            "category",
            "category_name",
            "account",
            "account_name",
            "notes",
            "frequency",
            "interval",
            "start_date",
            "end_date",
            "next_run_date",
            "last_run_date",
            "auto_create",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("last_run_date",)
        extra_kwargs = {"next_run_date": {"required": False}}

    def validate_category(self, value: Category):
        user = self.context["request"].user
        if value and not value.is_default and value.owner != user and not user.is_staff:
            raise serializers.ValidationError("You can only use your own custom categories.")
        return value

    def validate_account(self, value: Account | None):
        if value is None:
            return value
        user = self.context["request"].user
        if value.owner_id != user.id and not user.is_staff:
            raise serializers.ValidationError("Account is not accessible.")
        return value

    def validate(self, attrs):
        txn_type = attrs.get("txn_type", getattr(self.instance, "txn_type", None))
        category = attrs.get("category", getattr(self.instance, "category", None))
        account = attrs.get("account", getattr(self.instance, "account", None))
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        next_run_date = attrs.get("next_run_date", getattr(self.instance, "next_run_date", None))
        interval = attrs.get("interval", getattr(self.instance, "interval", 1))
        owner = getattr(self.instance, "owner", self.context["request"].user)

        if interval < 1:
            raise serializers.ValidationError({"interval": "Interval must be at least 1."})

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
        if account and account.owner_id != owner.id:
            raise serializers.ValidationError(
                {"account": "Wallet must belong to the same user as the recurring transaction."}
            )

        if end_date and start_date and end_date < start_date:
            raise serializers.ValidationError({"end_date": "End date cannot be before start date."})
        if next_run_date and start_date and next_run_date < start_date:
            raise serializers.ValidationError(
                {"next_run_date": "Next run date cannot be before start date."}
            )
        return attrs

    def create(self, validated_data):
        if not validated_data.get("next_run_date"):
            validated_data["next_run_date"] = validated_data["start_date"]
        return super().create(validated_data)


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


class GoalContributionSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoalContribution
        fields = ("id", "amount", "contribution_date", "notes", "created_at")
        read_only_fields = ("id", "created_at")


class GoalContributionCreateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    contribution_date = serializers.DateField(required=False, default=date.today)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)


class FinancialGoalSerializer(serializers.ModelSerializer):
    linked_account_name = serializers.CharField(source="linked_account.name", read_only=True)
    progress_percentage = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()
    contributions = GoalContributionSerializer(many=True, read_only=True)

    class Meta:
        model = FinancialGoal
        fields = (
            "id",
            "name",
            "target_amount",
            "current_amount",
            "target_date",
            "linked_account",
            "linked_account_name",
            "status",
            "notes",
            "progress_percentage",
            "remaining_amount",
            "contributions",
            "created_at",
            "updated_at",
        )

    def validate_linked_account(self, value: Account | None):
        if value is None:
            return value
        user = self.context["request"].user
        if value.owner_id != user.id and not user.is_staff:
            raise serializers.ValidationError("Account is not accessible.")
        return value

    def validate_target_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Target amount must be greater than zero.")
        return value

    def get_progress_percentage(self, obj: FinancialGoal):
        if obj.target_amount <= 0:
            return 0
        pct = (obj.current_amount / obj.target_amount) * Decimal("100")
        return float(min(pct, Decimal("100")))

    def get_remaining_amount(self, obj: FinancialGoal):
        remaining = obj.target_amount - obj.current_amount
        return remaining if remaining > 0 else Decimal("0")

    def validate(self, attrs):
        target_amount = attrs.get("target_amount", getattr(self.instance, "target_amount", Decimal("0")))
        current_amount = attrs.get("current_amount", getattr(self.instance, "current_amount", Decimal("0")))
        if current_amount < 0:
            raise serializers.ValidationError({"current_amount": "Current amount cannot be negative."})
        if target_amount > 0 and current_amount >= target_amount:
            attrs["status"] = FinancialGoal.STATUS_COMPLETED
        return attrs


class MonthlySummarySerializer(serializers.Serializer):
    month = serializers.IntegerField()
    year = serializers.IntegerField()
    total_income = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_expense = serializers.DecimalField(max_digits=12, decimal_places=2)
    savings = serializers.DecimalField(max_digits=12, decimal_places=2)


class DateRangeFilterSerializer(serializers.Serializer):
    year = serializers.IntegerField(required=False, default=date.today().year)
    month = serializers.IntegerField(required=False, min_value=1, max_value=12)


class AICategorizeSerializer(serializers.Serializer):
    description = serializers.CharField(allow_blank=True, max_length=500)
    txn_type = serializers.ChoiceField(choices=Transaction.TXN_TYPE_CHOICES, default=Transaction.EXPENSE)


class AICategoryFeedbackSerializer(serializers.Serializer):
    description = serializers.CharField(max_length=500)
    predicted_category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), allow_null=True, required=False
    )
    corrected_category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all())
    confidence = serializers.FloatField(required=False, allow_null=True, min_value=0.0, max_value=1.0)
    was_accepted = serializers.BooleanField(required=False, default=False)
    source = serializers.ChoiceField(choices=CategoryFeedback.SOURCE_CHOICES, default=CategoryFeedback.SOURCE_MANUAL)
    transaction = serializers.PrimaryKeyRelatedField(
        queryset=Transaction.objects.all(), allow_null=True, required=False
    )

    def _validate_category(self, user, category: Category | None):
        if category is None:
            return
        if category.is_default:
            return
        if not user.is_staff and category.owner_id != user.id:
            raise serializers.ValidationError("Category is not accessible.")

    def validate(self, attrs):
        request = self.context["request"]
        user = request.user

        self._validate_category(user, attrs.get("predicted_category"))
        self._validate_category(user, attrs.get("corrected_category"))

        transaction_obj = attrs.get("transaction")
        if transaction_obj and not user.is_staff and transaction_obj.owner_id != user.id:
            raise serializers.ValidationError({"transaction": ["Transaction is not accessible."]})

        return attrs


class ReceiptIngestionSerializer(serializers.Serializer):
    file = serializers.FileField()
    create_transaction = serializers.BooleanField(default=False)
    txn_type = serializers.ChoiceField(choices=Transaction.TXN_TYPE_CHOICES, default=Transaction.EXPENSE)

    def validate_file(self, value):
        max_mb = self.context.get("max_upload_mb", 8)
        if value.size > max_mb * 1024 * 1024:
            raise serializers.ValidationError(f"Receipt file too large. Limit is {max_mb} MB.")
        return value


class ReceiptIngestionResultSerializer(serializers.ModelSerializer):
    suggested_category_name = serializers.CharField(source="suggested_category.name", read_only=True)
    created_transaction_id = serializers.IntegerField(source="created_transaction.id", read_only=True)

    class Meta:
        model = ReceiptIngestion
        fields = (
            "id",
            "file_name",
            "merchant",
            "detected_amount",
            "detected_date",
            "txn_type",
            "suggested_category",
            "suggested_category_name",
            "category_confidence",
            "created_transaction_id",
            "status",
            "error_message",
            "metadata",
            "created_at",
        )
