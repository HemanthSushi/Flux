from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve
from django.views.generic import TemplateView
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView


from django.http import JsonResponse

def root_fallback(request, *args, **kwargs):
    return JsonResponse({
        "message": "Flux Personal Finance API is running.",
        "documentation": "/api/docs/swagger/",
        "status": "active"
    })

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/swagger/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/docs/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("finance.urls")),
    re_path(
        r"^(?P<path>(?:assets/.*|favicon\.ico|apple-touch-icon\.png|icon-192(?:-maskable)?\.png|icon-512(?:-maskable)?\.png|manifest\.json))$",
        serve,
        {"document_root": settings.BASE_DIR / "static"},
    ),
    re_path(r"^.*$", root_fallback),
]
