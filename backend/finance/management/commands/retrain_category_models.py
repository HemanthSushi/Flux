from django.core.management.base import BaseCommand

from finance.ai import retrain_all_user_models


class Command(BaseCommand):
    help = "Retrain AI category models for one user or all users."

    def add_arguments(self, parser):
        parser.add_argument("--user-id", type=int, help="Target user ID.")
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force retrain even when model is fresh.",
        )

    def handle(self, *args, **options):
        user_id = options.get("user_id")
        force = options.get("force", False)
        processed, retrained = retrain_all_user_models(force=force, user_id=user_id)
        self.stdout.write(
            self.style.SUCCESS(
                f"Retrain complete. processed_users={processed} retrained_users={retrained}"
            )
        )
