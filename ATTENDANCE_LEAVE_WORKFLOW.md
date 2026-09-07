# Attendance & Leave Approval Workflow

This document details the operational workflow for daily classroom attendance tracking and faculty leave request management in the ZUNA Mobile Application.

---

## 1. Classroom Attendance Workflow (Teacher Portal)

```
[Teacher Opens App] ──> [Selects Class & Subject] ──> [Roster Loaded]
                                                             │
                                                             v
[Status Toggled] <── [Taps Student Status Badge (Present/Absent/Late)]
       │
       v
[Save & Sync] ──> [Updates Zustand State / Firebase Database]
```

### Key Features:
* **Interactive Roster**: List of students with color-coded status badges:
  * 🟢 **Present**: Green indicator.
  * 🔴 **Absent**: Red indicator.
  * 🟡 **Late**: Yellow indicator.
* **Instant Toggle**: Single-tap cycle to update status in real time.
* **Attendance Analytics**: Daily percentage automatically aggregated into the Admin Executive Dashboard (Average Attendance: 96.4%).

---

## 2. Leave Request & Approval Workflow (Admin Portal)

```
[Faculty Submits Request] ──> [Appears in Admin 'Leave Approvals' Tab]
                                           │
                                           v
                       +-------------------+-------------------+
                       |                                       |
                       v                                       v
             [Approve Request]                          [Reject Request]
                       │                                       │
                       v                                       v
           [Status: Approved (Green)]              [Status: Rejected (Red)]
```

### Key Features:
* **Pending Queue**: Displays teacher name, leave reason, and duration.
* **One-Click Decision**: Instant Approve / Reject buttons with instant status updates.
* **Audit Trail**: Real-time record stored for payroll and attendance auditing.
