from rest_framework.routers import DefaultRouter
from apps.leads.api.views import LeadViewSet, LeadBatchViewSet, SiteVisitViewSet, FollowUpReminderViewSet, ProjectViewSet

app_name = "leads_api"

router = DefaultRouter()
router.register(r'leads', LeadViewSet, basename='lead')
router.register(r'batches', LeadBatchViewSet, basename='batch')
router.register(r'visits', SiteVisitViewSet, basename='visit')
router.register(r'reminders', FollowUpReminderViewSet, basename='reminder')
router.register(r'projects', ProjectViewSet, basename='project')

urlpatterns = router.urls
