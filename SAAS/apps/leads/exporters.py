import pandas as pd
import io
from django.http import HttpResponse
from apps.leads.models import Lead

class LeadExportService:
    @staticmethod
    def export_to_csv(queryset):
        """
        Exports a lead queryset to a CSV response.
        """
        data = []
        for lead in queryset:
            data.append({
                'First Name': lead.first_name,
                'Last Name': lead.last_name,
                'Phone': lead.phone,
                'Email': lead.email,
                'Status': lead.status,
                'Source': lead.source,
                'Assigned To': lead.assigned_to.email if lead.assigned_to else "Unassigned",
                'Created At': lead.created_at.strftime('%Y-%m-%d %H:%M')
            })
        
        df = pd.DataFrame(data)
        
        # Use StringIO for CSV
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        
        response = HttpResponse(csv_buffer.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="leads_export.csv"'
        return response

    @staticmethod
    def export_to_excel(queryset):
        """
        Exports a lead queryset to an Excel response.
        """
        data = []
        for lead in queryset:
            data.append({
                'First Name': lead.first_name,
                'Last Name': lead.last_name,
                'Phone': lead.phone,
                'Email': lead.email,
                'Status': lead.status,
                'Source': lead.source,
                'Assigned To': lead.assigned_to.email if lead.assigned_to else "Unassigned",
                'Created At': lead.created_at.strftime('%Y-%m-%d %H:%M')
            })
        
        df = pd.DataFrame(data)
        
        # Use BytesIO for Excel
        excel_buffer = io.BytesIO()
        with pd.ExcelWriter(excel_buffer, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
            
        response = HttpResponse(
            excel_buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="leads_export.xlsx"'
        return response
