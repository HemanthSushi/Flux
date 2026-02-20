from django.urls import path

from .views import (
    EmailVerificationConfirmView,
    EmailVerificationRequestView,
    ForgotPasswordView,
    LoginView,
    LogoutView,
    PasswordChangeView,
    ProfileView,
    RefreshView,
    RegisterView,
    ResetPasswordVerifyView,
    ResetPasswordView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", RefreshView.as_view(), name="refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("profile/", ProfileView.as_view(), name="profile"),
    path("change-password/", PasswordChangeView.as_view(), name="change-password"),
    path("email-verify/request/", EmailVerificationRequestView.as_view(), name="email-verify-request"),
    path("email-verify/confirm/", EmailVerificationConfirmView.as_view(), name="email-verify-confirm"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot-password"),
    path("reset-password/verify/", ResetPasswordVerifyView.as_view(), name="reset-password-verify"),
    path("reset-password/", ResetPasswordView.as_view(), name="reset-password"),
]
