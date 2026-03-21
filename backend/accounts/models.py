from django.conf import settings
from django.db import models


class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    full_name = models.CharField(max_length=120, blank=True)
    currency = models.CharField(max_length=10, default="USD")
    email_verified = models.BooleanField(default=False)
    email_verification_otp_hash = models.CharField(max_length=64, blank=True)
    email_verification_otp_expires_at = models.DateTimeField(null=True, blank=True)
    email_verification_otp_attempts = models.PositiveSmallIntegerField(default=0)
    failed_login_attempts = models.PositiveIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    last_password_change = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"Profile<{self.user.username}>"
