# Complete System Modules List

This document lists all active modules implemented across the ZUNA Web Dashboard and React Native CLI Mobile Application.

---

## 📱 Mobile App Modules (`mobile/App.tsx`)

| Module Name | Targeted Role | Key Capabilities |
| :--- | :--- | :--- |
| **Executive Dashboard** | Admin | Real-time KPIs: Enrolled Students, Attendance %, Fee Revenue, Faculty Count. |
| **Student Directory** | Admin | Searchable list, student onboarding modal, fee status toggle (Paid/Unpaid). |
| **Faculty Onboarding** | Admin | Staff registration modal, department assignments. |
| **Leave Approval System**| Admin | Review pending leave requests from teachers; approve/reject with instant state sync. |
| **Executive Audit Reports**| Admin | Native share dialog integration for exporting PDF/CSV reports. |
| **Classroom Timetable** | Teacher | Daily class schedule timeline with room & hour allocations. |
| **Live Attendance Marker**| Teacher | Tap-to-toggle student roster (Present, Absent, Late). |
| **Homework Manager** | Teacher | Subject homework creation modal & submission counter. |
| **Student Profile Card** | Student/Parent | Roll number, class section, academic advisor details. |
| **Grades & Progress** | Student/Parent | Graphical subject performance scores (Maths 94%, Physics 88%, etc.). |
| **Tuition & Receipts** | Student/Parent | Fee status display and digital receipt download handler. |
| **Assignment Upload** | Student/Parent | Submission dialog for active homework tasks. |

---

## 🌐 Web & API Infrastructure (`src/`, `api/`)
* REST & Firebase Integration endpoints
* Local OTA APK Distribution Server (`serve-apk.cjs` / `serve-apk.js`)
