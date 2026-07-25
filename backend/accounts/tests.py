import re
from unittest.mock import patch

from django.conf import settings
from django.core import mail
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.test import override_settings
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
        self.assertEqual(profile.email_verification_otp_hash, "")

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
        FRONTEND_BASE_URL="http://127.0.0.1:5173",
    )
    def test_email_verify_public_request_sends_register_link_and_otp(self):
        response = self.client.post(
            "/api/auth/email-verify/request-public/",
            {"email": self.user.email},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["detail"],
            "If an account with this email exists, a verification code has been sent.",
        )
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("/register?uid=", mail.outbox[0].body)
        self.assertIn("&token=", mail.outbox[0].body)
        self.assertRegex(mail.outbox[0].body, r"OTP code:\s*\d{6}")

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
        FRONTEND_BASE_URL="http://127.0.0.1:5173",
    )
    def test_email_verify_otp_confirm_endpoint(self):
        request_response = self.client.post(
            "/api/auth/email-verify/request-public/",
            {"email": self.user.email},
            format="json",
        )
        self.assertEqual(request_response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        match = re.search(r"OTP code:\s*(\d{6})", mail.outbox[0].body)
        self.assertIsNotNone(match)
        otp = match.group(1)

        confirm_response = self.client.post(
            "/api/auth/email-verify/confirm-otp/",
            {"email": self.user.email, "otp": otp},
            format="json",
        )
        self.assertEqual(confirm_response.status_code, 200)
        profile = Profile.objects.get(user=self.user)
        self.assertTrue(profile.email_verified)
        self.assertEqual(profile.email_verification_otp_hash, "")

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_email_verify_public_request_is_generic_for_unknown_email(self):
        response = self.client.post(
            "/api/auth/email-verify/request-public/",
            {"email": "unknown@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["detail"],
            "If an account with this email exists, a verification code has been sent.",
        )
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.console.EmailBackend",
        EMAIL_DEV_EXPOSE_OTP=True,
        DEBUG=True,
    )
    def test_email_verify_public_request_exposes_debug_otp_for_local_backend(self):
        response = self.client.post(
            "/api/auth/email-verify/request-public/",
            {"email": self.user.email},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["detail"],
            "If an account with this email exists, a verification code has been sent.",
        )
        self.assertRegex(response.data.get("debug_otp", ""), r"^\d{6}$")
        self.assertIn("Local email backend is active", response.data.get("email_error", ""))

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend",
        EMAIL_DEV_EXPOSE_OTP=True,
        DEBUG=True,
    )
    @patch("accounts.views.send_mail", side_effect=PermissionError("blocked"))
    def test_email_verify_public_request_uses_debug_fallback_when_smtp_fails(self, _mock_send_mail):
        response = self.client.post(
            "/api/auth/email-verify/request-public/",
            {"email": self.user.email},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["detail"],
            "If an account with this email exists, a verification code has been sent.",
        )
        self.assertRegex(response.data.get("debug_otp", ""), r"^\d{6}$")
        self.assertIn("SMTP connection was blocked", response.data.get("email_error", ""))
