import os
import sys
import django
sys.path.append('c:/Users/prath/OneDrive/Desktop/Saas project/SAAS')
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.leads.services.whatsapp_extractor import WhatsAppLeadExtractor

text = """*Clint name* - 
  Mobile No. 9764746086
*Bhk* - 2,3bhk
*Location*-, punawle
*Budject* - 
*SLG through project*
*Other Cp thru* - 
*Suggested project Name*- kolte patil uddan project suggested details shared
Gugali watsapp
Client choice
Wastu
Investor
End user
Client choice"""

leads = WhatsAppLeadExtractor.extract_multiple(text)
for lead in leads:
    print(lead)
