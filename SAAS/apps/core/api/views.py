from rest_framework.views import APIView
from rest_framework.response import Response
from apps.api.permissions import IsSuperAdmin
import psutil
import platform
import sys

class SystemConfigAPIView(APIView):
    """
    Returns system/VM metrics for the SuperAdmin dashboard.
    """
    permission_classes = [IsSuperAdmin]
    
    def get(self, request, *args, **kwargs):
        # CPU
        cpu_percent = psutil.cpu_percent(interval=0.1)
        cpu_cores = psutil.cpu_count(logical=True)
        
        # Memory
        virtual_mem = psutil.virtual_memory()
        ram_total = virtual_mem.total
        ram_used = virtual_mem.used
        ram_percent = virtual_mem.percent
        
        # Disk (Primary partition. Cross-platform safe)
        disk_usage = psutil.disk_usage('/')
        disk_total = disk_usage.total
        disk_used = disk_usage.used
        disk_percent = disk_usage.percent
        
        # OS / Metadata
        os_info = f"{platform.system()} {platform.release()}"
        python_ver = sys.version.split(" ")[0]
        
        data = {
            "status": "operational",
            "cpu": {
                "percent": cpu_percent,
                "cores": cpu_cores
            },
            "memory": {
                "total": ram_total,
                "used": ram_used,
                "percent": ram_percent
            },
            "disk": {
                "total": disk_total,
                "used": disk_used,
                "percent": disk_percent
            },
            "system": {
                "os": os_info,
                "python_version": python_ver
            }
        }
        
        return Response(data)
