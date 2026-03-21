import hashlib
import hmac
import secrets
import smtplib
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    EmailVerificationOTPConfirmSerializer,
    EmailVerificationRequestSerializer,
    EmailVerificationTokenSerializer,
    ForgotPasswordSerializer,
    LogoutSerializer,
    PasswordChangeSerializer,
    PasswordResetTokenSerializer,
    ProfileSerializer,
    RegisterSerializer,
    ResetPasswordSerializer,
    SecureTokenObtainPairSerializer,
)
from .models import Profile


def _email_backend_not_configured_response():
    if settings.EMAIL_BACKEND == "django.core.mail.backends.smtp.EmailBackend":
        if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
            return Response(
                {
                    "detail": (
                        "Email is not configured. Set EMAIL_HOST_USER and EMAIL_HOST_PASSWORD "
                        "in backend/.env, then restart the backend."
                    )
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
    return None


def _otp_hash_for_user(user, otp):
    value = f"{user.pk}:{otp}:{settings.SECRET_KEY}"
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _otp_ttl_minutes():
    return int(getattr(settings, "EMAIL_VERIFICATION_OTP_TTL_MINUTES", 10))


def _otp_max_attempts():
    return int(getattr(settings, "EMAIL_VERIFICATION_OTP_MAX_ATTEMPTS", 5))


def _create_email_verification_otp(user):
    profile, _ = Profile.objects.get_or_create(user=user)
    otp = f"{secrets.randbelow(1000000):06d}"
    profile.email_verification_otp_hash = _otp_hash_for_user(user, otp)
    profile.email_verification_otp_expires_at = timezone.now() + timedelta(minutes=_otp_ttl_minutes())
    profile.email_verification_otp_attempts = 0
    profile.save(
        update_fields=[
            "email_verification_otp_hash",
            "email_verification_otp_expires_at",
            "email_verification_otp_attempts",
        ]
    )
    return otp


def _clear_email_verification_otp(profile):
    profile.email_verification_otp_hash = ""
    profile.email_verification_otp_expires_at = None
    profile.email_verification_otp_attempts = 0
    profile.save(
        update_fields=[
            "email_verification_otp_hash",
            "email_verification_otp_expires_at",
            "email_verification_otp_attempts",
        ]
    )


def _send_verification_email(user):
    otp = _create_email_verification_otp(user)
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    verify_link = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/register?uid={uid}&token={token}"
    message = (
        "Verify your email address.\n\n"
        f"OTP code: {otp}\n"
        f"This code expires in {_otp_ttl_minutes()} minutes.\n\n"
        "You can also verify using this link:\n"
        f"{verify_link}\n\n"
        "If you did not request this, ignore this email."
    )
    send_mail(
        subject="Verify your email",
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "register"


class ProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, _ = Profile.objects.get_or_create(user=request.user)
        serializer = ProfileSerializer(profile)
        return Response(serializer.data)

    def patch(self, request):
        profile, _ = Profile.objects.get_or_create(user=request.user)
        serializer = ProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class LoginView(TokenObtainPairView):
    permission_classes = [permissions.AllowAny]
    serializer_class = SecureTokenObtainPairSerializer
    throttle_scope = "login"


class RefreshView(TokenRefreshView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "login"

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        refresh_token = serializer.validated_data["refresh"]
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            return Response({"detail": "Invalid refresh token."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Logout successful."})


class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        user_model = get_user_model()
        user = user_model.objects.filter(email__iexact=email, is_active=True).first()

        if settings.EMAIL_BACKEND == "django.core.mail.backends.smtp.EmailBackend":
            if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
                return Response(
                    {
                        "detail": (
                            "Email is not configured. Set EMAIL_HOST_USER and EMAIL_HOST_PASSWORD "
                            "in backend/.env, then restart the backend."
                        )
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_link = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/reset-password?uid={uid}&token={token}"
            message = (
                "We received a request to reset your password.\n\n"
                f"Use this link to continue:\n{reset_link}\n\n"
                "If you did not request this, you can ignore this email."
            )
            try:
                send_mail(
                    subject="Reset your password",
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )
            except Exception as exc:
                if isinstance(exc, smtplib.SMTPAuthenticationError) or "5.7.8" in str(exc):
                    return Response(
                        {
                            "detail": (
                                "SMTP authentication failed. For Gmail, use a 16-character App Password "
                                "(no spaces) and ensure 2-Step Verification is enabled."
                            )
                        },
                        status=status.HTTP_502_BAD_GATEWAY,
                    )
                return Response(
                    {"detail": f"Email sending failed: {str(exc)}"},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

        return Response(
            {"detail": "If an account with this email exists, a password reset link has been sent."}
        )


class ResetPasswordVerifyView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = PasswordResetTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response({"detail": "Reset token is valid."})


class ResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]
        new_password = serializer.validated_data["new_password"]
        user.set_password(new_password)
        user.save(update_fields=["password"])
        profile, _ = Profile.objects.get_or_create(user=user)
        profile.last_password_change = timezone.now()
        profile.save(update_fields=["last_password_change"])
        return Response({"detail": "Password has been reset successfully."})


class PasswordChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "password_change"

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        profile, _ = Profile.objects.get_or_create(user=request.user)
        profile.last_password_change = timezone.now()
        profile.save(update_fields=["last_password_change"])
        return Response({"detail": "Password changed successfully."})


class EmailVerificationRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "email_verify"

    def post(self, request):
        profile, _ = Profile.objects.get_or_create(user=request.user)
        if profile.email_verified:
            return Response({"detail": "Email is already verified."})
        if not request.user.email:
            return Response(
                {"detail": "No email is set on this account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        backend_error = _email_backend_not_configured_response()
        if backend_error:
            return backend_error

        try:
            _send_verification_email(request.user)
        except Exception as exc:
            if isinstance(exc, smtplib.SMTPAuthenticationError) or "5.7.8" in str(exc):
                return Response(
                    {
                        "detail": (
                            "SMTP authentication failed. For Gmail, use a 16-character App Password "
                            "(no spaces) and ensure 2-Step Verification is enabled."
                        )
                    },
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            return Response(
                {"detail": f"Email sending failed: {str(exc)}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({"detail": "Verification code sent."})


class EmailVerificationPublicRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "email_verify"

    def post(self, request):
        serializer = EmailVerificationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        backend_error = _email_backend_not_configured_response()
        if backend_error:
            return backend_error

        email = serializer.validated_data["email"]
        user_model = get_user_model()
        user = user_model.objects.filter(email__iexact=email, is_active=True).first()
        generic_response = {
            "detail": "If an account with this email exists, a verification code has been sent."
        }
        if not user:
            return Response(generic_response)

        profile, _ = Profile.objects.get_or_create(user=user)
        if profile.email_verified:
            return Response(generic_response)

        try:
            _send_verification_email(user)
        except Exception as exc:
            if isinstance(exc, smtplib.SMTPAuthenticationError) or "5.7.8" in str(exc):
                return Response(
                    {
                        "detail": (
                            "SMTP authentication failed. For Gmail, use a 16-character App Password "
                            "(no spaces) and ensure 2-Step Verification is enabled."
                        )
                    },
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            return Response(
                {"detail": f"Email sending failed: {str(exc)}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(generic_response)


class EmailVerificationOTPConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "email_verify"

    def post(self, request):
        serializer = EmailVerificationOTPConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        otp = serializer.validated_data["otp"]

        user_model = get_user_model()
        user = user_model.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            return Response(
                {"detail": "Invalid verification code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile, _ = Profile.objects.get_or_create(user=user)
        if profile.email_verified:
            return Response({"detail": "Email verified successfully."})

        if not profile.email_verification_otp_hash or not profile.email_verification_otp_expires_at:
            return Response(
                {"detail": "No verification code found. Request a new code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if profile.email_verification_otp_expires_at <= timezone.now():
            _clear_email_verification_otp(profile)
            return Response(
                {"detail": "Verification code has expired. Request a new code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if profile.email_verification_otp_attempts >= _otp_max_attempts():
            _clear_email_verification_otp(profile)
            return Response(
                {"detail": "Too many failed attempts. Request a new code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        expected_hash = _otp_hash_for_user(user, otp)
        if not hmac.compare_digest(profile.email_verification_otp_hash, expected_hash):
            profile.email_verification_otp_attempts += 1
            profile.save(update_fields=["email_verification_otp_attempts"])
            return Response(
                {"detail": "Invalid verification code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile.email_verified = True
        profile.email_verification_otp_hash = ""
        profile.email_verification_otp_expires_at = None
        profile.email_verification_otp_attempts = 0
        profile.save(
            update_fields=[
                "email_verified",
                "email_verification_otp_hash",
                "email_verification_otp_expires_at",
                "email_verification_otp_attempts",
            ]
        )
        return Response({"detail": "Email verified successfully."})


class EmailVerificationConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "email_verify"

    def post(self, request):
        serializer = EmailVerificationTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        profile, _ = Profile.objects.get_or_create(user=user)
        if not profile.email_verified:
            profile.email_verified = True
            profile.email_verification_otp_hash = ""
            profile.email_verification_otp_expires_at = None
            profile.email_verification_otp_attempts = 0
            profile.save(
                update_fields=[
                    "email_verified",
                    "email_verification_otp_hash",
                    "email_verification_otp_expires_at",
                    "email_verification_otp_attempts",
                ]
            )
        return Response({"detail": "Email verified successfully."})
