"""
URL configuration for LeadFlow CRM.

All API endpoints are versioned under /api/v1/.
"""
from django.contrib import admin
from django.urls import include, path
from django.conf import settings

urlpatterns = [
    path("admin/", admin.site.urls),
    # API v1 namespace
    path("api/v1/", include("apps.api.urls")),
    path("api/v1/", include("apps.leads.api.urls")),
    path('api/v1/audits/', include('apps.audits.api.urls')),
    path('api/v1/accounts/', include('apps.accounts.api.urls')),
    path('api/v1/superadmin/clients/', include('apps.clients.api.urls')),
    path('api/v1/superadmin/system/', __import__('apps.core.api.views', fromlist=['']).SystemConfigAPIView.as_view(), name='system-config'),
]

if settings.DEBUG:
    import debug_toolbar
    urlpatterns += [
        path("__debug__/", include(debug_toolbar.urls)),
    ]
