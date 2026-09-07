# ZUNA School Management System - Product Brochure

Welcome to **ZUNA**, the next-generation school management ecosystem built for modern educational institutions.

---

## 📱 Mobile App Highlights (React Native CLI)

Built using **React Native CLI (v0.87)**, TypeScript, and Native Android layout optimizations, the ZUNA Mobile App provides a seamless experience for every user role:

### 🏢 1. Admin Portal
* **Executive Dashboard**: Real-time KPI counters:
  * 🎓 **Total Enrolled Students**: 1,248+
  * 📊 **Average Attendance**: 96.4%
  * 💵 **Fees Collected**: $142,500
  * 👨‍🏫 **Active Faculty Count**: 64
* **Quick Actions**:
  * **Register Student**: Onboard new students into class rosters.
  * **Add Faculty**: Register professors and staff members.
  * **Export Executive Reports**: Export audit reports via native share dialogs.
* **Sub-Tabs**: Overview, Student Directory, Leave Approvals, and Financials.

### 👨‍🏫 2. Teacher Portal
* **Interactive Timetable**: Daily schedule with class hours and room assignments.
* **Live Attendance Marker**: Quick toggle roster for **Present**, **Absent**, and **Late** statuses.
* **Homework Manager**: Assign subject homework and track student submission counts.

### 🎓 3. Student & Parent Portal
* **Personalized Profile**: Class section, roll number, and academic advisor details.
* **Grades & Progress**: Visual breakdown of subject performance (Maths 94%, Physics 88%, etc.).
* **Tuition & Receipts**: Fee status tracker and digital receipt download handler.
* **Homework Submissions**: Direct assignment upload modal.

---

## 🚀 Key Technical Innovations
* **Safe Area & Notch Refinement**: Dynamic top padding (`Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 16 : 20`) preventing layout overlapping with device notches and status bar icons.
* **Offline JavaScript Asset Bundle**: Fast, offline standalone execution via `index.android.bundle`.
* **Instant Wi-Fi OTA Distribution**: Download and install native `.apk` packages directly over local Wi-Fi networks using `serve-apk.cjs` on port `8080`.
