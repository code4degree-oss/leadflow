"""
Production settings for DY LeadFlow CRM.
"""
from .base import *  # noqa

DEBUG = False

ALLOWED_HOSTS = env.list('DJANGO_ALLOWED_HOSTS')

CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS')
CORS_ALLOW_CREDENTIALS = True

# Security Settings (Configurable via ENV, defaults to True for production)
USE_SSL = env.bool('USE_SSL', default=True)

# Tell Django to trust the X-Forwarded-Proto header from Nginx
# This prevents infinite redirect loops when using Uvicorn behind a proxy
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

SECURE_SSL_REDIRECT = USE_SSL
SESSION_COOKIE_SECURE = USE_SSL
CSRF_COOKIE_SECURE = USE_SSL
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_HSTS_SECONDS = 31536000 if USE_SSL else 0  # 1 year if SSL enabled
SECURE_HSTS_INCLUDE_SUBDOMAINS = USE_SSL
SECURE_HSTS_PRELOAD = USE_SSL

# Email backend (to be configured later e.g., with SendGrid)
# EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

# Sentry Configuration (if DSN provided)
SENTRY_DSN = env('SENTRY_DSN', default=None)
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        traces_sample_rate=1.0,
        send_default_pii=True
    )
