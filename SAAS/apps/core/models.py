import uuid
from django.db import models
from django.utils import timezone


class SoftDeleteManager(models.Manager):
    """Default manager that excludes soft-deleted records."""
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class AllObjectsManager(models.Manager):
    """Manager that includes soft-deleted records (for admin/audit use)."""
    pass


class BaseModel(models.Model):
    """
    Abstract base model that provides:
    - UUID primary key
    - client_id foreign key (multi-tenancy)
    - created_at / updated_at timestamps
    - Soft-delete (is_deleted + deleted_at) instead of hard-delete
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Every model MUST belong to a ClientAccount (except SuperAdmin user models)
    client = models.ForeignKey('clients.ClientAccount', on_delete=models.CASCADE, null=True, blank=True)

    # Soft-delete fields
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    # Default manager excludes deleted records
    objects = SoftDeleteManager()
    # Use all_objects when you need to include deleted records (e.g., admin audit)
    all_objects = AllObjectsManager()

    def delete(self, using=None, keep_parents=False):
        """Soft-delete: marks as deleted instead of removing from DB."""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=['is_deleted', 'deleted_at', 'updated_at'])

    def hard_delete(self, using=None, keep_parents=False):
        """Actually remove from DB. Use only when absolutely necessary."""
        super().delete(using=using, keep_parents=keep_parents)

    def restore(self):
        """Restore a soft-deleted record."""
        self.is_deleted = False
        self.deleted_at = None
        self.save(update_fields=['is_deleted', 'deleted_at', 'updated_at'])

    class Meta:
        abstract = True
        ordering = ['-created_at']

