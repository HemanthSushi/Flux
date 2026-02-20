from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APITestCase

from .models import Profile


User = get_user_model()


class SecurityUpgradeTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="secure-user",
            email="secure@example.com",
            password="OldPass123!",
        )

    def test_login_lockout_after_failed_attempts(self):
        for _ in range(int(getattr(settings, "LOGIN_MAX_FAILED_ATTEMPTS", 5))):
            response = self.client.post(
                "/api/auth/login/",
                {"username": "secure-user", "password": "WrongPass999!"},
                format="json",
            )
            self.assertEqual(response.status_code, 401)

        profile = Profile.objects.get(user=self.user)
        self.assertIsNotNone(profile.locked_until)

        locked_resp = self.client.post(
            "/api/auth/login/",
            {"username": "secure-user", "password": "OldPass123!"},
            format="json",
        )
        self.assertEqual(locked_resp.status_code, 401)

    def test_change_password_endpoint(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/auth/change-password/",
            {
                "current_password": "OldPass123!",
                "new_password": "NewPass123!",
                "confirm_password": "NewPass123!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewPass123!"))

    def test_email_verify_confirm_endpoint(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)

        response = self.client.post(
            "/api/auth/email-verify/confirm/",
            {"uid": uid, "token": token},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        profile = Profile.objects.get(user=self.user)
        self.assertTrue(profile.email_verified)
