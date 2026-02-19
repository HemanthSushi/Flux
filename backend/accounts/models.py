from django.conf import settings
from django.db import models


class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    full_name = models.CharField(max_length=120, blank=True)
    currency = models.CharField(max_length=10, default="USD")

    def __str__(self) -> str:
        return f"Profile<{self.user.username}>"
