# Testing & Quality Assurance Guide

This document covers testing procedures for the **ZUNA React Native CLI Mobile Application** and local distribution infrastructure.

---

## 📱 1. Mobile App Testing (React Native CLI)

### Unit & Component Tests
Run Metro test runner:
```bash
cd mobile
npm test
```

### Manual UI & Role Testing (`mobile/App.tsx`)
1. **Admin Portal**:
   - Verify KPI cards update dynamically.
   - Test "Register Student" modal open/close and state updates.
   - Test "Add Faculty" modal inputs.
   - Test "Leave Approvals" Approve and Reject actions.
2. **Teacher Portal**:
   - Verify class timetable renders.
   - Test tapping attendance badges (cycle: Present -> Absent -> Late).
   - Test "Add Homework" modal submission.
3. **Student / Parent Portal**:
   - Verify profile card, subject scores, and fee status.
   - Test homework assignment upload dialog.

---

## 🤖 2. Native Android Layout & Notch Verification
* Verify on notched Android emulators/devices that top titles do not collide with status bar items (clock, camera cutouts).
* Ensure `SafeAreaProvider` and dynamic status bar padding are active.

---

## 📡 3. Local Distribution Server Testing (`serve-apk.cjs`)
1. Start the distribution server:
   ```bash
   node serve-apk.cjs
   ```
2. Open `http://localhost:8080` in a browser.
3. Verify that downloading `app-debug.apk` begins instantly.
