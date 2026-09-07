# Client Presentation & Demonstration Workflow

This document outlines the step-by-step demonstration guide for presenting the **ZUNA School Management System** and **React Native CLI Mobile Application** to stakeholders and clients.

---

## 🎯 Presentation Objectives
1. Demonstrate full multi-role access (Admin, Teacher, Student/Parent) in a single React Native mobile application.
2. Show real-time KPI metrics, attendance marking, and fee management features.
3. Demonstrate native Android build deployment and instant local Wi-Fi distribution.

---

## 📋 Step-by-Step Demonstration Script

### Step 1: Launch Local Distribution Server
* Run the local OTA Wi-Fi server:
  ```bash
  node serve-apk.cjs
  ```
* Open the browser on a mobile device on the same network: `http://10.48.78.69:8080`.
* Show instant APK download and installation capability.

### Step 2: Open ZUNA Mobile App (`mobile/App.tsx`)
* Launch the application on Android/iOS device or emulator.
* Point out the **Header & Safe Area Notch Handling**: Notice how top titles ("School Management" and "ZUNA" badge) cleanly clear camera notch cutouts and status bar indicators.

### Step 3: Admin Portal Walkthrough
* Switch role tab to **Admin**.
* Review Executive KPIs: Enrolled Students, Average Attendance, Fee Collections, and Faculty Count.
* Click **Register Student** modal to demonstrate form input.
* Click **Export Executive Reports** to showcase native share options.

### Step 4: Teacher Portal Walkthrough
* Switch role tab to **Teacher**.
* Show **Today's Class Schedule** timeline.
* Open **Attendance Marker** and toggle student statuses between Present, Absent, and Late.
* Open **Homework Manager** to create a subject assignment.

### Step 5: Student / Parent Portal Walkthrough
* Switch role tab to **Student / Parent**.
* Show profile card, roll number, and class details.
* Display subject grades breakdown and attendance metrics.
* Show tuition fee status and assignment submission dialog.
