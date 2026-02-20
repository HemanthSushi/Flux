from datetime import date

from django.core.management.base import BaseCommand, CommandError

from finance.views import process_due_recurring_transactions


class Command(BaseCommand):
    help = "Generate due transactions from active recurring transaction schedules."

    def add_arguments(self, parser):
        parser.add_argument(
            "--as-of",
            type=str,
            default=None,
            help="Process schedules due up to YYYY-MM-DD (default: today).",
        )
        parser.add_argument(
            "--user-id",
            type=int,
            default=None,
            help="Process schedules for a specific user id.",
        )

    def handle(self, *args, **options):
        as_of_raw = options.get("as_of")
        user_id = options.get("user_id")

        target_date = date.today()
        if as_of_raw:
            try:
                target_date = date.fromisoformat(as_of_raw)
            except ValueError as exc:
                raise CommandError("--as-of must be in YYYY-MM-DD format.") from exc

        result = process_due_recurring_transactions(user_id=user_id, as_of=target_date)
        self.stdout.write(
            self.style.SUCCESS(
                "Processed recurring schedules: "
                f"processed={result['processed_schedules']} generated={result['generated_transactions']} "
                f"skipped={result['skipped']} as_of={target_date.isoformat()}"
            )
        )
