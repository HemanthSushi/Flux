from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Profile

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    full_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    currency = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ("id", "username", "email", "password", "full_name", "currency")

    def create(self, validated_data):
        full_name = validated_data.pop("full_name", "")
        currency = validated_data.pop("currency", "USD")
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        profile, _ = Profile.objects.get_or_create(user=user)
        profile.full_name = full_name
        if currency:
            profile.currency = currency
        profile.save()
        return user


class SecureTokenObtainPairSerializer(TokenObtainPairSerializer):
    default_error_messages = {
        "locked": "Account is temporarily locked due to repeated failed login attempts. Try again later."
    }

    def validate(self, attrs):
        username = attrs.get(self.username_field)
        user_lookup = {f"{self.username_field}__iexact": username} if username else {}
        user = User.objects.filter(**user_lookup).first() if user_lookup else None
        profile = None
        if user:
            profile, _ = Profile.objects.get_or_create(user=user)
            if profile.locked_until and profile.locked_until > timezone.now():
                raise AuthenticationFailed(self.error_messages["locked"])

        try:
            data = super().validate(attrs)
        except AuthenticationFailed:
            if profile:
                max_attempts = int(getattr(settings, "LOGIN_MAX_FAILED_ATTEMPTS", 5))
                lock_minutes = int(getattr(settings, "LOGIN_LOCK_MINUTES", 15))
                profile.failed_login_attempts += 1
                if profile.failed_login_attempts >= max_attempts:
                    profile.failed_login_attempts = 0
                    profile.locked_until = timezone.now() + timedelta(minutes=lock_minutes)
                profile.save(update_fields=["failed_login_attempts", "locked_until"])
            raise

        if profile:
            profile.failed_login_attempts = 0
            profile.locked_until = None
            profile.save(update_fields=["failed_login_attempts", "locked_until"])
            data["email_verified"] = profile.email_verified
        return data


class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email")
    role = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = ("username", "email", "full_name", "currency", "email_verified", "role")
        read_only_fields = ("email_verified",)

    def get_role(self, obj: Profile) -> str:
        return "admin" if obj.user.is_staff else "user"

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        if "email" in user_data:
            instance.user.email = user_data["email"]
            instance.user.save(update_fields=["email"])
        return super().update(instance, validated_data)


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class PasswordResetTokenSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()

    default_error_messages = {"invalid_token": "Invalid or expired reset token."}

    def validate(self, attrs):
        user_model = get_user_model()
        try:
            user_id = force_str(urlsafe_base64_decode(attrs["uid"]))
            user = user_model.objects.get(pk=user_id, is_active=True)
        except Exception:
            raise serializers.ValidationError({"token": [self.error_messages["invalid_token"]]})

        if not default_token_generator.check_token(user, attrs["token"]):
            raise serializers.ValidationError({"token": [self.error_messages["invalid_token"]]})

        attrs["user"] = user
        return attrs


class ResetPasswordSerializer(PasswordResetTokenSerializer):
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        attrs = super().validate(attrs)

        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": ["Passwords do not match."]})

        try:
            validate_password(attrs["new_password"], attrs["user"])
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"new_password": list(exc.messages)})

        return attrs


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, min_length=8)
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        request = self.context["request"]
        user = request.user

        if not user.check_password(attrs["current_password"]):
            raise serializers.ValidationError({"current_password": ["Current password is incorrect."]})

        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": ["Passwords do not match."]})

        try:
            validate_password(attrs["new_password"], user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"new_password": list(exc.messages)})

        return attrs


class EmailVerificationTokenSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()

    default_error_messages = {"invalid_token": "Invalid or expired verification token."}

    def validate(self, attrs):
        user_model = get_user_model()
        try:
            user_id = force_str(urlsafe_base64_decode(attrs["uid"]))
            user = user_model.objects.get(pk=user_id, is_active=True)
        except Exception:
            raise serializers.ValidationError({"token": [self.error_messages["invalid_token"]]})

        if not default_token_generator.check_token(user, attrs["token"]):
            raise serializers.ValidationError({"token": [self.error_messages["invalid_token"]]})

        attrs["user"] = user
        return attrs
