from rest_framework import permissions


class IsOwnerOrAdmin(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user and request.user.is_staff:
            return True
        owner = getattr(obj, "owner", None)
        if owner is not None:
            return owner == request.user
        monthly_budget = getattr(obj, "monthly_budget", None)
        if monthly_budget is not None:
            return monthly_budget.owner == request.user
        return False
