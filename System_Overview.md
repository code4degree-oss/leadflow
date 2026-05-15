# DY LeadFlow CRM - System Architecture & Detailed Overview

## 1. Executive Summary
DY LeadFlow CRM is a comprehensive, production-grade, multi-tenant SaaS application tailored for efficient lead lifecycle management, distribution, and field agent coordination. The system is designed to handle multiple administrative layers while providing a specialized daily workflow for telecallers and a robust mobile application for field agents.

## 2. System Architecture

The application is built on a distributed, modern three-tier architecture:

### 2.1. Backend Architecture (Django)
- **Framework:** Django & Django REST Framework (DRF)
- **Role:** Handles core business logic, API provisioning, data access, multi-tenancy rules, and background processing.
- **Key Modules / Apps (`SAAS/apps/`):**
  - `accounts`: Handles users, roles, OTP-based login, and authentication settings.
  - `clients`: Multi-tenant data segregation, tenant configurations (e.g., geofencing parameters).
  - `leads`: Core logic for lead ingestion, deduplication, follow-ups, lost lead escalation, and distribution mapping.
  - `audits`: Comprehensive system logging for administrative and operational actions.
  - `api`: Common API routing and utilities.
  - `core`: Shared infrastructure, utility functions, and foundational models.

### 2.2. Web Frontend (Next.js / React)
- **Framework:** Next.js (Pages Router) & React.js
- **Styling:** Tailwind CSS
- **Role:** The primary web interface for Super Admins, Client Admins, and Telecallers.
- **Key Characteristics:** 
  - Dynamic role-based dashboards (`pages/superadmin/`, `pages/admin/`).
  - Interactive telecaller workflow (daily cycle UI, dynamic lead drawer).
  - Visual configurations: Google Maps DrawingManager integration for polygon-based geofencing and radius geofencing for employee logins.

### 2.3. Mobile Application (React Native / Expo)
- **Framework:** React Native, Expo, React Navigation
- **State & Data Handling:** Zustand, React Query, Axios, AsyncStorage
- **Components:** Expo Location (for geospatial tracking), Expo Notifications (Firebase push notifications).
- **Role:** Provides Field Agents with an on-the-go interface for lead management, attendance, and remote syncing.

### 2.4. Infrastructure & Integrations
- **Database:** Relational Database (Optimized for Django multi-tenant architectures).
- **Push Notifications & Auth:** Firebase Cloud Messaging (FCM) and Firebase Auth for push notifications and robust OTP login.
- **Geospatial & Mapping:** Google Maps API for geocoding, radius logic, and custom polygon drawing for geofences.

---

## 3. Feature List

### 3.1. Role-Based Access Control & Security
- **Multi-layered Roles:** Super Admin, Client Admin, Telecaller, and Field Agent.
- **Phone & Email Masking:** Secures sensitive lead contact data from telecaller views to prevent data theft.
- **Data Isolation:** Robust multi-tenant data querying isolation (tenant boundaries).
- **OTP Authentication:** Secure secondary authentication powered by Firebase.

### 3.2. Lead Management System (LMS)
- **Lead Ingestion & Deduplication:** Ensures data hygiene upon importing or API creation.
- **Lead Distribution:** Customizable logic mapping leads to the right agents or telecallers.
- **Lost Lead Escalation Engine:**
  - Automated reassignment logic.
  - `lost_count` tracking.
  - Queueing for admin review and final disposition.
- **Hot Leads System:** Flagging leads that require immediate executive attention.

### 3.3. Telecaller & Follow-up Workflows
- **Interactive Daily Cycle UI:** "My Leads" dynamic viewing and drawer elements.
- **Multi-Follow-up History:** Visual timeline representing past interactions.
- **Reminder & Scheduling:** Built-in alerts (dashboard & push) for future follow-up commitments and site visits.

### 3.4. Field Agent Operations & Geofencing
- **Geofenced Check-ins:** 
  - Admins can draw exact **Polygon boundaries** or configure **Radius-based** circles on the map.
  - Prevents agents from logging actions or attendance outside of authorized zones.
- **Real-time Location:** Integrates with mobile device GPS.

### 3.5. Audit & Analytics
- **System-Wide Audits:** Granular state changes (who changed what, when) and historical tracking.
- **Follow-up / Conversion Metrics:** Expected pipeline analytics.

---

## 4. Key Workflows

1. **The Telecaller Routine:** 
   Telecallers log in and are presented with a prioritized list of leads. They can click on a lead to slide open an interactive drawer, log calls, schedule next step follow-ups (which trigger scheduled reminders), or mark leads as "hot" or "lost."
   
2. **The Escalation Path:**
   If a telecaller drops a lead (marks as lost), the system auto-increments the `lost_count`. The lead is securely routed to the Admin Review Queue, where the admin can either permanently archive the lead or reassign it.
   
3. **The Field Agent Check-in:**
   An agent arrives on-site. The mobile app cross-references their current GPS coordinates utilizing `expo-location` against the custom polygon geofence drawn by the admin in the Next.js portal. If valid, the visit or action is successfully logged.
