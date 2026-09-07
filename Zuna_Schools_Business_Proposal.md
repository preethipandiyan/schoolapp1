# ZUNA Schools Management System - Business Proposal

## Executive Summary
ZUNA Schools Management System is an enterprise-grade, multi-tenant digital school management platform designed to streamline administrative workflows, simplify fee management, empower teachers, and keep parents/students connected in real time.

The solution includes a web dashboard and a native **React Native CLI Mobile Application** supporting Android and iOS with multi-role access (Admin, Teacher, Student/Parent).

---

## Key Value Propositions
1. **Unified Multi-Role Mobile App (React Native CLI)**: Single mobile application tailored for Admins, Teachers, and Students/Parents with dynamic role switching and safe area notch handling.
2. **Real-time Financials & Fee Tracking**: Automated fee collection logging, receipt generation, and real-time status indicators (Paid/Unpaid).
3. **Attendance & Leave Management**: Live classroom attendance marking with quick status toggling (Present, Absent, Late) and one-click teacher leave approval workflows.
4. **Offline Capability & Fast Bundling**: Pre-packaged offline JavaScript bundles (`index.android.bundle`) ensuring high-speed local performance and standalone execution.
5. **Over-The-Air (OTA) Wi-Fi Deployment**: Lightweight local distribution server (`serve-apk.cjs`) enabling instant Wi-Fi downloads of native Android Debug APKs without cable connectivity.

---

## Core System Architecture
```
                         +-----------------------------+
                         |    ZUNA Web Dashboard       |
                         +--------------+--------------+
                                        |
                                        v
                         +-----------------------------+
                         |      REST / Firebase API    |
                         +--------------+--------------+
                                        |
                   +--------------------+--------------------+
                   |                                         |
                   v                                         v
     +---------------------------+             +---------------------------+
     |   React Native CLI App    |             |   Local OTA Server        |
     |   (Admin / Teacher /      |             |   (serve-apk.cjs :8080)   |
     |    Student Portals)       |             +---------------------------+
     +---------------------------+
```

---

## Financial Plan & Implementation Roadmap
* **Phase 1: Architecture & Web Portal** - Multi-tenant backend, authentication, database setup, and core dashboard.
* **Phase 2: React Native CLI Mobile App** - Cross-platform mobile app with Admin, Teacher, and Parent/Student portals (`mobile/App.tsx`).
* **Phase 3: Android Compilation & OTA Distribution** - Gradle build pipeline, standalone asset bundling, and Wi-Fi installer server.
* **Phase 4: Production Deployment & Onboarding** - Staging deployment, audit logging, user training, and maintenance support.
