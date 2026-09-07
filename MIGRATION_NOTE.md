# Migration & Technical Integration Notes

This document provides technical reference notes regarding the architecture, framework choices, and build configurations for the ZUNA School Management System.

---

## 📱 React Native CLI Architecture (`mobile/`)
* **React Native Version**: 0.87
* **Primary Language**: TypeScript (`App.tsx`)
* **State Management**: Zustand
* **UI Layout Framework**: Native Flexbox with `react-native-safe-area-context`
* **Navigation**: `@react-navigation/native` & `@react-navigation/bottom-tabs`

---

## ⚙️ Android Build Configuration (`mobile/android/`)
* **Gradle Bundle Path**: `mobile/android/app/src/main/assets/index.android.bundle`
* **Compiled APK Location**: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`
* **Over-the-Air Delivery Script**: `serve-apk.cjs` running on local port `8080`.

---

## 🔧 Notch & Status Bar Adjustment Settings
To ensure zero title overlap on notched devices (punch-hole cameras, top cutouts):
```typescript
paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 16 : 20
```
This guarantees crisp header alignment across all target Android devices.
