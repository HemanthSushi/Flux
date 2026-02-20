from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import Account, Category, FinancialGoal, RecurringTransaction, Transaction


User = get_user_model()


class FinanceFeatureTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="finance-user",
            email="finance@example.com",
            password="TestPass123!",
        )
        self.other_user = User.objects.create_user(
            username="other-user",
            email="other@example.com",
            password="OtherPass123!",
        )
        self.client.force_authenticate(user=self.user)
        self.expense_category = Category.objects.create(name="Food", is_default=True, owner=None)

    def test_wallet_can_be_assigned_to_transaction(self):
        wallet_resp = self.client.post(
            "/api/wallets/",
            {
                "name": "Primary Bank",
                "account_type": "bank",
                "currency": "INR",
                "opening_balance": "1200.00",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(wallet_resp.status_code, 201)
        wallet_id = wallet_resp.data["id"]

        tx_resp = self.client.post(
            "/api/transactions/",
            {
                "txn_type": "expense",
                "amount": "25.50",
                "category": self.expense_category.id,
                "account": wallet_id,
                "date": date.today().isoformat(),
                "notes": "Lunch",
            },
            format="json",
        )
        self.assertEqual(tx_resp.status_code, 201)
        self.assertEqual(tx_resp.data["account"], wallet_id)
        self.assertEqual(tx_resp.data["account_name"], "Primary Bank")

    def test_wallet_must_belong_to_transaction_owner(self):
        other_wallet = Account.objects.create(
            owner=self.other_user,
            name="Other Wallet",
            account_type=Account.TYPE_WALLET,
            currency="INR",
            opening_balance=Decimal("200"),
        )
        tx_resp = self.client.post(
            "/api/transactions/",
            {
                "txn_type": "expense",
                "amount": "10.00",
                "category": self.expense_category.id,
                "account": other_wallet.id,
                "date": date.today().isoformat(),
                "notes": "Should fail",
            },
            format="json",
        )
        self.assertEqual(tx_resp.status_code, 400)
        self.assertIn("account", tx_resp.data)

    def test_wallet_transaction_filter_and_summary_endpoint(self):
        bank = Account.objects.create(
            owner=self.user,
            name="Bank",
            account_type=Account.TYPE_BANK,
            currency="INR",
            opening_balance=Decimal("1000.00"),
        )
        cash = Account.objects.create(
            owner=self.user,
            name="Cash",
            account_type=Account.TYPE_CASH,
            currency="INR",
            opening_balance=Decimal("100.00"),
        )
        Transaction.objects.create(
            owner=self.user,
            txn_type=Transaction.EXPENSE,
            amount=Decimal("20.00"),
            category=self.expense_category,
            account=bank,
            date=date.today(),
            notes="Bank spend",
        )
        Transaction.objects.create(
            owner=self.user,
            txn_type=Transaction.EXPENSE,
            amount=Decimal("5.00"),
            category=self.expense_category,
            account=cash,
            date=date.today(),
            notes="Cash spend",
        )

        filtered = self.client.get(f"/api/transactions/?account={bank.id}")
        self.assertEqual(filtered.status_code, 200)
        self.assertEqual(filtered.data["count"], 1)
        self.assertEqual(filtered.data["results"][0]["account"], bank.id)

        summary = self.client.get(f"/api/wallets/{bank.id}/transactions/")
        self.assertEqual(summary.status_code, 200)
        self.assertEqual(summary.data["count"], 1)
        self.assertEqual(Decimal(summary.data["summary"]["total_expense"]), Decimal("20.00"))

    def test_run_due_generates_recurring_transactions_once(self):
        recurring = RecurringTransaction.objects.create(
            owner=self.user,
            txn_type=Transaction.EXPENSE,
            amount=Decimal("80.00"),
            category=self.expense_category,
            notes="Weekly groceries",
            frequency=RecurringTransaction.FREQ_WEEKLY,
            interval=1,
            start_date=date.today(),
            next_run_date=date.today(),
            auto_create=True,
            is_active=True,
        )

        first_run = self.client.post(
            "/api/recurring-transactions/run_due/",
            {"as_of": date.today().isoformat()},
            format="json",
        )
        self.assertEqual(first_run.status_code, 200)
        self.assertEqual(first_run.data["generated_transactions"], 1)

        self.assertTrue(
            Transaction.objects.filter(
                owner=self.user,
                source_recurring=recurring,
                recurrence_for_date=date.today(),
            ).exists()
        )

        second_run = self.client.post(
            "/api/recurring-transactions/run_due/",
            {"as_of": date.today().isoformat()},
            format="json",
        )
        self.assertEqual(second_run.status_code, 200)
        self.assertEqual(second_run.data["generated_transactions"], 0)

    def test_goal_contribution_updates_progress(self):
        goal_resp = self.client.post(
            "/api/goals/",
            {
                "name": "Emergency Fund",
                "target_amount": "1000.00",
                "current_amount": "100.00",
                "status": "active",
            },
            format="json",
        )
        self.assertEqual(goal_resp.status_code, 201)
        goal_id = goal_resp.data["id"]

        contribution_resp = self.client.post(
            f"/api/goals/{goal_id}/contribute/",
            {"amount": "950.00"},
            format="json",
        )
        self.assertEqual(contribution_resp.status_code, 201)

        goal = FinancialGoal.objects.get(id=goal_id)
        self.assertEqual(goal.current_amount, Decimal("1050.00"))
        self.assertEqual(goal.status, FinancialGoal.STATUS_COMPLETED)
