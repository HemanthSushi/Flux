from django.contrib.auth import get_user_model
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import serializers

from .models import Profile


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
        profile = user.profile
        profile.full_name = full_name
        if currency:
            profile.currency = currency
        profile.save()
        return user


class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email")
    role = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = ("username", "email", "full_name", "currency", "role")

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
