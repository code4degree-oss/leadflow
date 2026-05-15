"""
Development settings for DYLeadFlow CRM.
"""
from .base import *  # noqa

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env.bool('DJANGO_DEBUG', default=True)

ALLOWED_HOSTS = ['*']

# CORS Configuration for local development - allow all origins
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# Add debug toolbar in development
INSTALLED_APPS += ["debug_toolbar", "django_extensions"]
MIDDLEWARE.insert(0, "debug_toolbar.middleware.DebugToolbarMiddleware")

# Internal IPs for debug toolbar
INTERNAL_IPS = ["127.0.0.1"]

# Email backend for development
EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend")
