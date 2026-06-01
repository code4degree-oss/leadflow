from rest_framework import viewsets
from apps.api.mixins import TenantQuerySetMixin
from apps.api.permissions import IsTelecallerOrHigher, IsClientAdmin
from apps.accounts.models import RoleChoices
from apps.leads.api.serializers import ProjectSerializer
from apps.leads.models import Project

class ProjectViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [IsTelecallerOrHigher]
    queryset = Project.objects.all()

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.role in (RoleChoices.TELECALLER, RoleChoices.FIELD_AGENT):
            qs = qs.filter(is_active=True)

        bhk = self.request.query_params.get('bhk')
        if bhk == '1':
            qs = qs.filter(has_1bhk=True, available_1bhk__gt=0)
        elif bhk == '2':
            qs = qs.filter(has_2bhk=True, available_2bhk__gt=0)
        elif bhk == '3':
            qs = qs.filter(has_3bhk=True, available_3bhk__gt=0)

        return qs

    def perform_create(self, serializer):
        serializer.save(client=self.request.user.client)

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsClientAdmin()]
        return super().get_permissions()
